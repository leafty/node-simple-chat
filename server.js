/**
* Node Simple Chat
* Server implementation
* Author: Johann-Michael Thiebaut <johann.thiebaut@gmail.com>
*/

var express = require('express'),
    fs = require('fs'),
    app = express(),
    config = JSON.parse(fs.readFileSync('config.json').toString());

app.set('database', config[app.get('env')].database);
app.set('server', config[app.get('env')].server);

app.get('/', function(req, res){
  res.send("Hello world!");
});

app.listen(3000);
console.log('Listening on port 3000');
