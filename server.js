/**
* Node Simple Chat
* Server implementation
* Author: Johann-Michael Thiebaut <johann.thiebaut@gmail.com>
*/

var express = require('express');
var fs = require('fs');

var msg = require('./lib/messages');

var app = express();

var config = JSON.parse(fs.readFileSync('config.json').toString());

var users = {};
var defers = [];

app.set('database', config[app.get('env')].database);
app.set('server', config[app.get('env')].server);
app.use(express.bodyParser());

app.get('/', function(req, res) {
  res.send("Hello world!");
});

app.get('/messages', function(req, res) {
  var n = 10;
  if ('n' in req.query) {
    n = req.query.n;
  }

  msg.getLastMessages(n, function(err, docs) {
    if (err) {
      res.send(500, err);
    } else {
      res.json({ messages: docs });
    }
  });
});

app.get('/next-messages', function(req, res) {
  var d = new Date();
  if ('d' in req.query) {
    d.setTime(req.query.d);
  }

  msg.getMessagesSince(d, function(err, docs) {
    if (err) {
      res.send(500, err);
    } else {
      if (docs.length == 0) {
        defers.push({ res: res, date: d });
      } else {
        res.json({ messages: docs });
      }
    }
  });
});

app.post('/connect', function(req, res) {
  var user;
  if ('user' in req.body) {
    user = req.body.user.toString();
    if (user in users) {
      res.send(400, "User already exists");
    } else {
      users[user] = {
        name: user,
        last: new Date(),
        res: res
      };

      // When the user disconnects
      res.on('close', function() {
        console.log(user + ' left');
        msg.notify(user + ' left', function(err) {
          if (err) {
            console.log(err);
          }

          // Notify polling clients
          notify();
        });
        delete users[user];
      });

      console.log(user + ' joined');
      msg.notify(user + ' joined', function(err) {
        if (err) {
          console.log(err);
        }

        // Notify polling clients
        notify();
      });
    }
  } else {
    res.send(400, "Provide user name", function() {});
  }
});

app.post('/message', function(req, res) {
  var user, message;
  if ('user' in req.body && 'message' in req.body) {
    user = req.body.user.toString();
    message = req.body.message.toString();
    if (user in users) {
      msg.post(user, message, function(err) {
        if (err) {
          console.log(err);
        }

        // Notify polling clients
        notify();
      });
      res.send(200);
    } else {
      res.send(400, "Unknown user");
    }
  } else {
    res.send(400, "Provide user name and message");
  }
});

msg.connectToDb(config.development.database, function(err) {
  if (err) {
    console.log(err);
  } else {
    app.listen(3000);
    console.log('Listening on port 3000');
  }
});

function notify() {
  for (var i = 0 ; i < defers.length ; i++) {
    (function(defer) {
      msg.getMessagesSince(defer.date, function(err, docs) {
        if (err) {
          defer.res.send(500, err);
        } else {
          defer.res.json({ messages: docs });
        }
      });
    })(defers[i]);
  }

  defers = [];
}
