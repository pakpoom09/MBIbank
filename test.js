var express = require('express');
var app = express();

app.use(express.static(__dirname + '/public'));


app.get('/peekDialogs', function(req, res) {
  res.render('/testPage.html');
  /*res.render('testPage', { name: 'Tobi' }, function(err, html) {
    // ...
  });*/

});
var text = "How much do u want?"
if(text.indexOf("How much") > -1)
{
  console.log("INPUT INTEGERRRRRRRRRRRRR!!");
}
else{
  console.log("NOT INTEGERRRRRRRRRRRRR!!");
}


var port = process.env.PORT || 7777;
app.listen(port, function() {
    console.log('Starting node.js on port ' + port);
});





// Test json
// var json_obj = {};
// json_obj = {name:"asdasdasd"};
// json_obj[10] = {name:"firstOBJ"}
// json_obj[20] = {name:"secondOBJ"};
// console.log(json_obj.name);
// console.log(json_obj[0]);
// console.log(json_obj[10]);
//
// for(var x in json_obj)
// {
//   console.log(x);
// }
//










// var message = 'button_Conasdf asdf asdf 1000?_[yes,yes]|[no,no]';
// var words = message.split("_");
//
// var messageData;
// if(words[0] == "button")
// {
//     messageData = {
//     recipient: {
//       id: '1111'
//     },
//     message: {
//       attachment: {
//         type: "template",
//         payload: {
//           template_type: "button",
//           text: words[1],
//           buttons:[]
//         }
//       }
//     }
//   };
//   console.log("Before MessageData:"+JSON.stringify(messageData));
//       var btns = words[2].split("|");
//       for(var x in btns)
//       {
//         var btn = btns[x].slice(0,-1);
//         var texts = btn.split(",");
//
//         if(texts[0].startsWith("http"))
//           messageData.message.attachment.payload.buttons[x] = {type: "web_url",url:texts[0],title:texts[1]};
//           else {
//             messageData.message.attachment.payload.buttons[x] = {type: "postback",payload:texts[0],title:texts[1]};
//           }
//
//       }
//     console.log("MessageData:"+JSON.stringify(messageData));
// }
