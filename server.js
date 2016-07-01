/* Copyright IBM Corp. 2014 All Rights Reserved                      */
'use strict';
// Require and create the Express framework
var express = require('express');
var cfenv = require('cfenv');
var app = express();
var bodyParser = require('body-parser');
var config = require('config');
var crypto = require('crypto');
var https = require('https');
var request = require('request');
var fs     = require('fs');


var watson = require('watson-developer-cloud');
var dialog_service = watson.dialog({
  username: 'ca0ba909-8f58-4c5e-97c7-bef0380f0357',
  password: 'RGYgRD8VZzfO',
  version: 'v1'
});



// Determine port to listen on
//var port = (process.env.VCAP_APP_PORT || 5000);
var appEnv = cfenv.getAppEnv();

// Enable reverse proxy support in Express. This causes the
// the "X-Forwarded-Proto" header field to be trusted so its
// value can be used to determine the protocol. See
// http://expressjs.com/api#app-settings for more details.
app.enable('trust proxy');

// Add a handler to inspect the req.secure flag (see
// http://expressjs.com/api#req.secure). This allows us
// to know whether the request was via http or https.

/*
app.use (function (req, res, next) {
	if (req.secure) {
		// request was via https, so do no special handling
		next();
	} else {
		// request was via http, so redirect to https
		res.redirect('https://' + req.headers.host + req.url);
	}
});*/

// Allow static files in the /public directory to be served
//app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Start listening on the port
/*
var server = app.listen(port, function() {
	console.log('Listening on port %d', server.address().port);
});*/




// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN)) {
  console.error("Missing config values");
  process.exit(1);
}

//get dialogs

app.get('/getDialogs', function (req, res) {
dialog_service.getDialogs({}, function(err, dialogs) {
  if (err)
    console.log(err)
  else
  {
    console.log(dialogs);
    res.send(dialogs);
  }
});
});

app.get('/setDialogs', function (req, res) {
  var params = {
    name: 'my-dialog100',
    file: fs.createReadStream('Exercise_8_end.xml')
  };

  dialog_service.createDialog(params, function(err, dialog) {
    if (err)
      console.log(err)
    else
      console.log(dialog);
  });

});


//create dialogs

app.get('/updateDialogs', function (req, res) {
var params = {
  dialog_id: 'ebeb09eb-9523-47e2-981e-b64ad82334d1',
  file: fs.createReadStream('template.xml')
};

dialog_service.updateDialog(params, function(err, dialog) {
  if (err)
    console.log(err)
  else
    console.log(dialog);
});
res.send('updated!');
});
/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */


app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});


/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page.
 * https://developers.facebook.com/docs/messenger-platform/implementation#subscribe_app_pages
 *
 */

 var clients ={};

app.post('/webhook', function (req, res) {

  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {

          //Client_id handle
          if(!clients[messagingEvent.sender.id])
          {
             clients[messagingEvent.sender.id] = {client_id: '', conversation_id: '', classifier: ''};
          }


        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to
 * Messenger" plugin, it is the 'data-ref' field. Read more at
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference#auth
 *
 */

function receivedAuthentication(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;


  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger'
  // plugin.
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam,
    timeOfAuth);

  // When an authentication is received, we'll send a message back to the sender
  // to let them know it was successful.
  console.log("UserID: "+senderID+" Authentication successful");
  sendTextMessage(senderID, "Authentication successful");
}


/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message'
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference#received_message
 *
 * For this example, we're going to echo any text that we get. If we get some
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've
 * created. If we receive a message with an attachment (image, video, audio),
 * then we'll simply confirm that we've received the attachment.
 *
 */

 var json_message;
 var bool_intCheck = false;

function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;


  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);


  var messageId = message.mid;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachment;

  console.log("Attachhhhhhhhhhhh"+messageAttachments);

  messageText = messageText;

  if(bool_intCheck)
  {
     if(!isNaN(parseFloat(messageText)) && isFinite(messageText) && (parseFloat(messageText) > 0.0))
     {
       bool_intCheck = false;
     }
     else
     {
        sendTextMessage(senderID,"Please input a valid number");
     return 0;
     }
  }




//Watson dialog
//client_id: '', conversation_id: '', classifier: ''
var params = {
    conversation_id: clients[senderID].conversation_id,
    dialog_id: 'ebeb09eb-9523-47e2-981e-b64ad82334d1',
    client_id: clients[senderID].client_id,
    input:     messageText
  };
if (messageText) {

dialog_service.conversation(params, function(err, conversation) {
  if (err)
  {
    console.log(JSON.stringify(err));
  }
  else
  {
    json_message = conversation;

    if(clients[senderID].client_id == '')
    {
        clients[senderID].client_id = conversation.client_id;
        clients[senderID].conversation_id = conversation.conversation_id;
    }

    console.log("RESPONSE:"+json_message.response[0]);

    if(json_message.response[0].indexOf("How much") > -1)
    {
      bool_intCheck = true;
      console.log("INPUT INTEGERRRRRRRRRRRRR!!");
    }



      // If we receive a text message, check to see if it matches any special
      // keywords and send back the corresponding example. Otherwise, just echo
      // the text we received.

        if(json_message.response[0].substring(0,5) == 'image')
          sendImageMessage(senderID,json_message.response[0]);

        else if(json_message.response[0].substring(0,6) == 'button')
          sendButtonMessage(senderID,json_message.response[0]);

        else if(json_message.response[0].substring(0,7) == 'generic')
          sendGenericMessage(senderID,json_message.response[0]);

        else if(json_message.response[0].substring(0,7) == 'receipt')
          sendReceiptMessage(senderID,json_message.response[0]);

        else if (messageText == 'ภาคภูมิ')
        sendTextMessage(senderID,"เป็นคนที่ใจหล่อมากครับ นับถือๆ เรียนอยู่มหิดลปี3 สนใจ inboxมาครับ");

        else if (messageText.indexOf('stock') > -1)
        {
            //sendTextMessage(senderID,"Your stock profile consist of:");
            sendTextMessage(senderID,json_message.response[0]);
            sendGenericMessage(senderID,"generic|stock");
            // sendGenericMessage(senderID,"generic|stock|BTS|ABC co.,Ltd|9.10|-0.05(-0.55%)|2130|https://scontent.fbkk2-1.fna.fbcdn.net/v/t35.0-12/13555571_10210095055913201_587333576_o.jpg?oh=79ede7c6c0edcc0df2bd1791daf1f0d4&oe=577626E0");
            // sendGenericMessage(senderID,"generic|stock|CPF|CBA co.,Ltd|28.25|-0.5(-1.74%)|2000|https://scontent.fbkk2-1.fna.fbcdn.net/v/t35.0-12/13548820_10210095055753197_1505649912_o.jpg?oh=329763116161dcffbf759c129c349364&oe=577620D5");
            // sendGenericMessage(senderID,"generic|stock|AOT|Tomato co.,Ltd|389.00|+3(+0.78%)|150|https://scontent.fbkk2-1.fna.fbcdn.net/v/t35.0-12/13570331_10210095055833199_707701137_o.png?oh=1d0e49eb3eca36d8281fe1dc15c27f50&oe=577642F4");
            // sendGenericMessage(senderID,"generic|stock|BEM|MEB co.,Ltd|6.70|+0.35(+5.51%)|1220|https://scontent.fbkk2-1.fna.fbcdn.net/v/t35.0-12/13570227_10210095055953202_177087_o.jpg?oh=67098e1d0888c5545a8dd0acd24cd358&oe=5775EE27");
            // sendGenericMessage(senderID,"generic|stock|PTT|TTP co.,Ltd|320.00|+1(+0.31%)|180|");
// sendGenericMessage(senderID,"generic|stock|BTS|ABC co.,Ltd|9.10|-0.05(-0.55%)|2130|http://gdriv.es/mbibank/9_10.jpg"
//                 +  "|CPF|CBA co.,Ltd|28.25|-0.5(-1.74%)|2000|http://gdriv.es/mbibank/28_25.jpg"
//                 +  "|AOT|Tomato co.,Ltd|389.00|+3(+0.78%)|150|http://gdriv.es/mbibank/389.png"
//                 +  "|BEM|MEB co.,Ltd|6.70|+0.35(+5.51%)|1220|http://gdriv.es/mbibank/6_70.jpg"
//                 +  "|PTT|TTP co.,Ltd|320.00|+1(+0.31%)|180|http://gdriv.es/mbibank/320.png");

        }
        else
          sendTextMessage(senderID,json_message.response[0]);

}
});
}else if(messageAttachments) {
  sendTextMessage(senderID, "Message with attachment received");
}
//

}


/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference#message_delivery
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s",
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}


/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. Read
 * more at https://developers.facebook.com/docs/messenger-platform/webhook-reference#postback
 *
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);


  var client_id = clients[senderID].client_id;
  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful

  var params = {
      conversation_id: clients[senderID].conversation_id,
      dialog_id: 'ebeb09eb-9523-47e2-981e-b64ad82334d1',
      client_id: clients[senderID].client_id,
      input:     payload
    };

  dialog_service.conversation(params, function(err, conversation) {
    if (err)
    {
      console.log(JSON.stringify(err));
    }
    else
    {
      console.log(JSON.stringify(conversation));
      json_message = conversation;

      if(clients[senderID].client_id == '')
      {
          clients[senderID].client_id = conversation.client_id;
          clients[senderID].conversation_id = conversation.conversation_id;
      }

      console.log("Post_RESPONSE:"+json_message.response[0]);
      console.log("RESPONSE:"+json_message.response[0]);

      if(json_message.response[0].indexOf("How much") > -1)
      {
        bool_intCheck = true;
        console.log("INPUT INTEGERRRRRRRRRRRRR!!");
      }

  if(json_message.response[0].substring(0,5) == 'image')
    sendImageMessage(senderID,json_message.response[0]);

  else if(json_message.response[0].substring(0,6) == 'button')
    sendButtonMessage(senderID,json_message.response[0]);

  else if(json_message.response[0].substring(0,7) == 'generic')
    sendGenericMessage(senderID,json_message.response[0]);

  else if(json_message.response[0].substring(0,7) == 'receipt')
    sendReceiptMessage(senderID,json_message.response[0]);

  else if (payload == 'ภาคภูมิ')
    sendTextMessage(senderID,"เป็นคนที่ใจหล่อมากครับ นับถือๆ เรียนอยู่มหิดลปี3 สนใจ inboxมาครับ");
  else
    sendTextMessage(senderID,json_message.response[0]);
}
});

}


/*
 * Send a message with an using the Send API.
 *
 */
function sendImageMessage(recipientId,message) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: "http://i.imgur.com/zYIlgBl.png"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId,message) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: message
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId,message) {

     //button_question_[https://abc.com,buttonName][payloadName,buttonName]........
/*
     var messageData = {
       recipient: {
         id: recipientId
       },
       message: {
         attachment: {
           type: "template",
           payload: {
             template_type: "button",
             text: "This is test text",
             buttons:[{
               type: "web_url",
               url: "https://www.oculus.com/en-us/rift/",
               title: "Open Web URL"
             }, {
               type: "postback",
               title: "Call Postback",
               payload: "Developer defined postback"
             }]
           }
         }
       }
     };
*/
      var words = message.split("_");

      var messageData;
      if(words[0] == "button")
      {
          messageData = {
          recipient: {
            id: recipientId
          },
          message: {
            attachment: {
              type: "template",
              payload: {
                template_type: "button",
                text: words[1],
                buttons:[]
              }
            }
          }
        };
        console.log("Before MessageData:"+JSON.stringify(messageData));
            var btns = words[2].split("|");
            for(var x in btns)
            {
              var texts = btns[x].split(",");

              if(texts[0].startsWith("http"))
                messageData.message.attachment.payload.buttons[x] = {type: "web_url",url:texts[0],title:texts[1]};
                else {
                  messageData.message.attachment.payload.buttons[x] = {type: "postback",payload:texts[0],title:texts[1]};
                }

            }
          console.log("MessageData:"+JSON.stringify(messageData));
      }

  callSendAPI(messageData);
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId,message) {

  var words = message.split("|");

  var messageData;
  if(words[1] == ("receipt"))
  {
  messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [{
              title: words[3],
              subtitle: words[4],
              item_url: "",
              image_url: words[2],
              buttons: null
            }]
          }
        }
      }
    };
  }else if(words[1] == "stock"){
    console.log(message);
    messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: [
               {
                  "title":"BTS",
                  "subtitle":"Company: ABC co.,Ltd\nPrice: 9.10\nChange: -0.05(-0.55%)\nAmount: 2130",
                  "image_url":"https://4efc536e79c499dec484069e649cf13144a407f3.googledrive.com/host/0BzxuTooYYPajTkRqTmMwWlVCY0k/9_10.jpg"
               },
               {
                  "title":"CPF",
                  "subtitle":"Company: CBA co.,Ltd\nPrice: 28.25\nChange: -0.5(-1.74%)\nAmount: 2000",
                  "image_url":"https://4efc536e79c499dec484069e649cf13144a407f3.googledrive.com/host/0BzxuTooYYPajTkRqTmMwWlVCY0k/28_25.jpg"
               },
               {
                  "title":"AOT",
                  "subtitle":"Company: Tomato co.,Ltd\nPrice: 389.00\nChange: +3(+0.78%)\nAmount: 150",
                  "image_url":"https://4efc536e79c499dec484069e649cf13144a407f3.googledrive.com/host/0BzxuTooYYPajTkRqTmMwWlVCY0k/389.png"
               },
               {
                  "title":"BEM",
                  "subtitle":"Company: MEB co.,Ltd\nPrice: 6.70\nChange: +0.35(+5.51%)\nAmount: 1220",
                  "image_url":"https://4efc536e79c499dec484069e649cf13144a407f3.googledrive.com/host/0BzxuTooYYPajTkRqTmMwWlVCY0k/6_70.jpg"
               },
               {
                  "title":"PTT",
                  "subtitle":"Company: TTP co.,Ltd\nPrice: 320.00\nChange: +1(+0.31%)\nAmount: 180",
                  "image_url":"https://4efc536e79c499dec484069e649cf13144a407f3.googledrive.com/host/0BzxuTooYYPajTkRqTmMwWlVCY0k/320.png"
               }
            ]
            }
          }
        }
      };
  }else if(words[1] == "stock_PTT"){
    sendTextMessage(recipientId,"From your portfolio, we recommend that you should invest more on the PTT due to its uptrend");
    messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: [
               {
                  "title":"PTT",
                  "subtitle":"Company: TTP co.,Ltd\nPrice: 320.00\nChange: +1(+0.31%)\nAmount: 180",
                  "image_url":"https://4efc536e79c499dec484069e649cf13144a407f3.googledrive.com/host/0BzxuTooYYPajTkRqTmMwWlVCY0k/320.png"
               }
            ]
            }
          }
        }
      };
  }
  else if(words[1] == "checkpetroprice"){
    console.log("retro_price");
    var url = 'http://www.pttplc.com/th/getoilprice.aspx/';
    request(url, function(error, response, html){
        if(!error){
            var $ = cheerio.load(html);
            var title, release, rating;
            var json = { title : "", release : "", rating : ""};
            $('#g_2963d969_94e5_4921_b8c3_9739b0799200_ctl00_uxGasoline95PriceDiv').filter(function(){
                var data = $(this);
                var gasoline95 = data['0']['children'][0]['data'];
            });
            $('#g_2963d969_94e5_4921_b8c3_9739b0799200_ctl00_uxGasohol91PriceDiv').filter(function(){
                var data = $(this);
                var gasohol91 = data['0']['children'][0]['data'];
            });
            $('#g_2963d969_94e5_4921_b8c3_9739b0799200_ctl00_uxGasohol95PriceDiv').filter(function(){
                var data = $(this);
                var gasohol95 = data['0']['children'][0]['data'];
            });
            $('#g_2963d969_94e5_4921_b8c3_9739b0799200_ctl00_uxGasoholE20PriceDiv').filter(function(){
                var data = $(this);
                var gasoholE20 = data['0']['children'][0]['data'];
            });
            $('#g_2963d969_94e5_4921_b8c3_9739b0799200_ctl00_uxGasoholE85PriceDiv').filter(function(){
                var data = $(this);
                var gasoholE85 = data['0']['children'][0]['data'];
            });
            $('#g_2963d969_94e5_4921_b8c3_9739b0799200_ctl00_uxDieselPriceDiv').filter(function(){
                var data = $(this);
                var diesel = data['0']['children'][0]['data'];
            });
            $('#g_2963d969_94e5_4921_b8c3_9739b0799200_ctl00_uxHyForcePremiumDieselDiv').filter(function(){
                var data = $(this);
                var premiumDiesel = data['0']['children'][0]['data'];
            });

        }
        messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: [{
                title: "gasoline95",
                subtitle: gasoline95,
                item_url: "https://www.facebook.com/napon.meka?fref=ts",
                image_url: "https://scontent.fbkk1-1.fna.fbcdn.net/v/t1.0-9/1521536_618191658217784_959036561_n.jpg?oh=893374610ec88dce0f472164439be16f&oe=57F0B2E6"
              }, {
                title: "gasohol91",
                subtitle: gasohol91,
                item_url: "https://www.facebook.com/ramkhana?fref=ts",
                image_url: "https://scontent.fbkk1-1.fna.fbcdn.net/v/t1.0-9/310015_10201311245843439_351152783_n.jpg?oh=fe3a424d8a4be9bdce443829dc878187&oe=57C51027"
              }]
            }
          }
        }
      };

        });
  }
  else
  {
    messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: [{
                title: "Dad",
                subtitle: "084-xxx-xxxx",
                item_url: "https://www.facebook.com/napon.meka?fref=ts",
                image_url: "https://scontent.fbkk1-1.fna.fbcdn.net/v/t1.0-9/1521536_618191658217784_959036561_n.jpg?oh=893374610ec88dce0f472164439be16f&oe=57F0B2E6",
                buttons: [{
                  type: "postback",
                  title: "Send money",
                  payload: "sendmoney_dad"
                }, {
                  type: "postback",
                  title: "Request money",
                  payload: "requestmoney_dad"
                }],
              }, {
                title: "Mom",
                subtitle: "087-xxx-xxxx",
                item_url: "https://www.facebook.com/ramkhana?fref=ts",
                image_url: "https://scontent.fbkk1-1.fna.fbcdn.net/v/t1.0-9/310015_10201311245843439_351152783_n.jpg?oh=fe3a424d8a4be9bdce443829dc878187&oe=57C51027",
                buttons: [{
                  type: "postback",
                  title: "Send money",
                  payload: "sendmoney_mom"
                }, {
                  type: "postback",
                  title: "Request money",
                  payload: "requestmoney_mom"
                }]
              }]
            }
          }
        }
      };
  }
/*  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Dad",
            subtitle: "084-xxx-xxxx",
            item_url: "https://www.facebook.com/napon.meka?fref=ts",
            image_url: "https://scontent.fbkk1-1.fna.fbcdn.net/v/t1.0-9/1521536_618191658217784_959036561_n.jpg?oh=893374610ec88dce0f472164439be16f&oe=57F0B2E6",
            buttons: [{
              type: "web_url",
              url: "https://www.facebook.com/napon.meka?fref=ts",
              title: "Open Facebook"
            }, {
              type: "postback",
              title: "Send money",
              payload: "payload_sendmoney"
            }, {
              type: "postback",
              title: "Send money2",
              payload: "payload_sm2"
            }],
          }, {
            title: "Mom",
            subtitle: "087-xxx-xxxx",
            item_url: "https://www.facebook.com/ramkhana?fref=ts",
            image_url: "https://scontent.fbkk1-1.fna.fbcdn.net/v/t1.0-9/310015_10201311245843439_351152783_n.jpg?oh=fe3a424d8a4be9bdce443829dc878187&oe=57C51027",
            buttons: [{
              type: "web_url",
              url: "https://www.facebook.com/ramkhana?fref=ts",
              title: "Open Facebook"
            }, {
              type: "postback",
              title: "Send money",
              payload: "payload_sendmoney2"
            }]
          }]
        }
      }
    }
  };
*/
  callSendAPI(messageData);
}

/*
 * Send a receipt message using the Send API.
 *
 */
function sendReceiptMessage(recipientId,message) {
  // Generate a random receipt ID as the API requires a unique ID
  var receiptId = "order" + Math.floor(Math.random()*1000);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{
      attachment: {
        type: "template",
        payload: {
          template_type: "receipt",
          recipient_name: "Peter Chang",
          order_number: receiptId,
          currency: "USD",
          payment_method: "Visa 1234",
          timestamp: "1428444852",
          elements: [{
            title: "Oculus Rift",
            subtitle: "Includes: headset, sensor, remote",
            quantity: 1,
            price: 599.00,
            currency: "USD",
            image_url: "http://messengerdemo.parseapp.com/img/riftsq.png"
          }, {
            title: "Samsung Gear VR",
            subtitle: "Frost White",
            quantity: 1,
            price: 99.99,
            currency: "USD",
            image_url: "http://messengerdemo.parseapp.com/img/gearvrsq.png"
          }],
          address: {
            street_1: "1 Hacker Way",
            street_2: "",
            city: "Menlo Park",
            postal_code: "94025",
            state: "CA",
            country: "US"
          },
          summary: {
            subtotal: 698.99,
            shipping_cost: 20.00,
            total_tax: 57.67,
            total_cost: 626.66
          },
          adjustments: [{
            name: "New Customer Discount",
            amount: -50
          }, {
            name: "$100 Off Coupon",
            amount: -100
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll
 * get the message id in a response
 *
 */

 app.get('/sendMessage/:text', function(req, res) {

     var _text = req.params.text;
   for(var x in clients)
   {
     console.log(x);

   var messageData = {
     recipient: {
       id: x
     },
     message: {
       text: _text
     }
   };
   callSendAPI(messageData);
   res.send('Message Sent!');
 }
 });
 //
 // https://graph.facebook.com/v2.6/<USER_ID>?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=<PAGE_ACCESS_TOKEN>

 app.get('/getUserProfile', function(req, res) {
   var JSoutput;

   for(var x in clients)
   {
     console.log(x);

    var options = { method: 'GET',
      url: 'https://graph.facebook.com/v2.6/'+x,
      qs:
       { fields: 'first_name,last_name,profile_pic,locale,timezone,gender',
         access_token: 'EAABzc1Fq7j8BAGFeK4Qetw8kNSP41OKvY0PmguonIutkMiqI5zHMSvHD6NT3wvY7MZAfxpviUrtPK4yZCryk41IfsjNvQYfZB7BhQOhpd25MClx5tGDKZC9F5gt6R8ZA32VuTqTouIBOpOvAal3QuEK4LmHlZAD98aNMTogOClCQZDZD' },
      headers:
       { 'postman-token': '29494b19-7316-29fb-27a7-c0eaac5518f6',
         'cache-control': 'no-cache',
         'content-type': 'application/json' } };

        request(options, function (error, response, body) {
          if (error) throw new Error(error);

          JSoutput = "USER_ID "+x+": "+JSON.stringify(body)+"\n";
          res.send(JSoutput);

        });
   }
  //  res.send(output);

});


function callSendAPI(messageData) {



  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s",
        messageId, recipientId);
        //here
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });
}




app.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
