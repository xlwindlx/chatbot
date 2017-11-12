/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    stateEndpoint: process.env.BotStateEndpoint,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector, function (session) {
    session.send("Sorry, i did not understand \"%s\". Type \"help\" if you need assistance ",session.message.text);
});

// LUIS 설정 
var LUIS_MODEL_URL = "https://southeastasia.api.cognitive.microsoft.com/luis/v2.0/apps/20920108-4ae7-447a-962d-97e982f0f5db?subscription-key=62220b5b8c714c50b0bd46388047e9c8&spellCheck=true&verbose=true&timezoneOffset=9.0&q=";
var recognizer = new builder.LuisRecognizer(LUIS_MODEL_URL);
bot.recognizer(recognizer);

bot.dialog('help', function(session) {
   session.endDialog("피자주문을 도와드리겠습니다! 어떤 피자를 원하세요? \"치즈피자 주문하겠습니다.\"라고 말씀해주세요"); 
}).triggerAction({
    matches :'help'
});


// 피자 주문 인식 
bot.dialog('Order Type', [
    function (session, args, next) {
        var pizzaTypeEntity = builder.EntityRecognizer.findEntity(args.intent.entities, "PizzaType");
        if (!pizzaTypeEntity) {
            builder.Prompts.text(session, '피자 종류를 말씀해주세요');
            return;
        }
        
        session.dialogData.pizzaType = pizzaTypeEntity.entity;
        builder.Prompts.luisPrompt(session, pizzaTypeEntity.entity + "를 주문합니다. 배달은 어디로 해드릴까요? \"땡땡땡으로 배달해주세요\"라고 말씀해주세요.");
    },
    function(session, results) {
        var streetNameEntity = builder.EntityRecognizer.findEntity(results.response.entities, "StreetName");
        var streetHouseNumberEntity = builder.EntityRecognizer.findEntity(results.response.entities, "StreetHouseNumber");
        var houseInsideAddressEntity = builder.EntityRecognizer.findEntity(results.response.entities, "HouseInsideAddress");
        
        session.dialogData.streetName = streetNameEntity.entity;
        session.dialogData.streetHouseNumber = streetHouseNumberEntity.entity;
        session.dialogData.houseInsideAddress = houseInsideAddressEntity.entity;
        
        session.endDialog(streetNameEntity.entity + "길" + streetHouseNumberEntity.entity + " " + houseInsideAddressEntity.entity + "로 배달해드리겠습니다. 결제는 어떻게 하시겠어요?");
    }
]).triggerAction({
    matches:'Order Type',
    onInterrupted: function (session) {
        session.send('피자 주문을 이어서 해주세요');
    }
});

// composite entities
var luisPrompt = new builder.Prompt({ defaultRetryPrompt : "I'm sorry. I didn't recognize your search."}).onRecognize(function (context, callback) {
    // Call prompts recognizer
    recognizer.recognize(context, function (err, result) {
        if (result && result.intent !== 'None') {
            callback(null, result.score, result);
        } else {
            callback(null, 0.0);
        }
    }); 
});

// Add your prompt as a dialog to your bot
bot.dialog('RecognizeAddress', luisPrompt);

// Add function for calling your prompt from anywhere
builder.Prompts.luisPrompt = function (session, prompt, options) {
    var args = options || {};
    args.prompt = prompt || options.prompt;
    session.beginDialog('RecognizeAddress', args);
} 