/**
* Simple long polling example
*/

var express = require('express');
var app = express();

var defers = [];

app.get('/', function(req, res){
  defers.push(res);
});

setInterval(function() {
  console.log(defers.length);

  for (i in defers) {
    defers[i].send("Later...");
  }

  defers = [];
}, 5000);

app.listen(3000);
console.log('Listening on port 3000');
