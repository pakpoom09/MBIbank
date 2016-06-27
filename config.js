//Welcome Message
var request = require("request");

var options = { method: 'POST',
  url: 'https://graph.facebook.com/v2.6/884216451688982/thread_settings',
  qs: { access_token: 'EAABzc1Fq7j8BAGFeK4Qetw8kNSP41OKvY0PmguonIutkMiqI5zHMSvHD6NT3wvY7MZAfxpviUrtPK4yZCryk41IfsjNvQYfZB7BhQOhpd25MClx5tGDKZC9F5gt6R8ZA32VuTqTouIBOpOvAal3QuEK4LmHlZAD98aNMTogOClCQZDZD' },
  headers:
   { 'postman-token': '32b62f86-b902-36a3-f45a-95a1c2e65025',
     'cache-control': 'no-cache',
     'content-type': 'application/json' },
  body: '{\nsetting_type:"call_to_actions",thread_state:"new_thread",call_to_actions:[\n    {\n      message:{\n        text:"Welcome! to MBIbank, type [Help] for more informations"\n      }\n    }]\n}' };

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});
