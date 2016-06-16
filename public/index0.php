<!--

Copyright 2016-present, Facebook, Inc.
All rights reserved.

This source code is licensed under the license found in the
LICENSE file in the root directory of this source tree.

-->
<html>
  <head>
    <title>Messenger Demo</title>
  </head>
  <body>
    <script>
      window.fbAsyncInit = function() {
        FB.init({
          appId: 'APP_ID',
          xfbml: true,
          version: 'v2.6'
        });
      };

      (function(d, s, id){
         var js, fjs = d.getElementsByTagName(s)[0];
         if (d.getElementById(id)) {return;}
         js = d.createElement(s); js.id = id;
         js.src = "//connect.facebook.net/en_US/sdk.js";
         fjs.parentNode.insertBefore(js, fjs);
       }(document, 'script', 'facebook-jssdk'));
    </script>

    <h1>Messenger Demo</h1>

    <div>
      <p>INDEX:0 The "Send to Messenger" plugin will trigger an authentication callback to your webhook.</p>

      <div class="fb-send-to-messenger"
        messenger_app_id='APP_ID'
        page_id='PAGE_ID'
        data-ref="PASS_THROUGH_PARAM"
        color="blue"
        size="standard">
      </div>
    </div>

    <div>
      <p>The "Message Us" plugin takes the user directly to Messenger and into a thread with your Page.</p>

      <div class="fb-messengermessageus"
        messenger_app_id='APP_ID'
        page_id='PAGE_ID'
        color="blue"
        size="standard">
      </div>
    </div>


   <form action="/getDialogs" method="get">
   <input type="submit" value="Submit">
   </form>


    <p>Output:</p>
  <div id="output">


  </div>


  </body>
</html>