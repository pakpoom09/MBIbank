var message = 'button_Conasdf asdf asdf 1000?_[yes,yes]|[no,no]';
var words = message.split("_");

var messageData;
if(words[0] == "button")
{
    messageData = {
    recipient: {
      id: '1111'
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
        var btn = btns[x].slice(0,-1);
        var texts = btn.split(",");

        if(texts[0].startsWith("http"))
          messageData.message.attachment.payload.buttons[x] = {type: "web_url",url:texts[0],title:texts[1]};
          else {
            messageData.message.attachment.payload.buttons[x] = {type: "postback",payload:texts[0],title:texts[1]};
          }

      }
    console.log("MessageData:"+JSON.stringify(messageData));
}
