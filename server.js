/**
* Node Simple Chat
* Server implementation
* Author: Johann-Michael Thiebaut <johann.thiebaut@gmail.com>
*/

var express = require('express');
var fs = require('fs');
var sanitize = require('validator').sanitize;

var msg = require('./lib/messages');

var app = express();

var config = JSON.parse(fs.readFileSync('config.json').toString());

var users = {};
var defers = [];

app.set('database', config[app.get('env')].database);
app.set('server', config[app.get('env')].server);
app.use(express.bodyParser());

app.get('/', function(req, res) {
  res.sendfile('index.html');
});

if (app.get('env') == 'development') {
  app.get('/client.js', function(req, res) {
    res.sendfile('client.js');
  });

  app.get('/style.css', function(req, res) {
    res.sendfile('style.css');
  });
}

app.get('/messages', function(req, res) {
  var n = 50;
  if ('n' in req.query) {
    n = sanitize(req.query.n).toInt();
  }

  msg.getLastMessages(n, function(err, docs) {
    if (err) {
      res.send(500, err);
    } else {
      res.json({ messages: docs, users: getUsers() });
    }
  });
});

app.get('/next-messages', function(req, res) {
  var d = new Date();
  if ('d' in req.query) {
    d.setTime(sanitize(req.query.d).toInt());
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

app.post('/user', function(req, res) {
  var user;
  if ('user' in req.body) {
    user = sanitize(req.body.user.toString()).xss();
    user = sanitize(user).entityEncode();
    user = sanitize(user).trim();
    if (user in users) {
      res.send(400, "User already exists");
    } else {
      users[user] = "pending";

      // free the name if something bad happened
      setTimeout(function() {
        if (user in users && users[user] == "pending") {
          console.log(user + " unregistered");
          delete users[user];
        }
      }, 5000);

      console.log(user + " registered");
      res.send(200, "User name accepted");
    }
  } else {
    res.send(400, "Provide user name", function() {});
  }
});

app.post('/connect', function(req, res) {
  var user, event;

  if ('user' in req.body) {
    user = sanitize(req.body.user.toString()).xss();
    user = sanitize(user).entityEncode();
    user = sanitize(user).trim();

    if (user in users) {
      if (users[user] == "pending") {
        users[user] = {
          name: user,
          last: new Date(),
          res: res
        };

        // When the user disconnects
        res.on('close', function() {
          users[user] = "waiting";

          setTimeout(function() {
            var event = { type: 'leave', usr: user };
            if (user in users && users[user] == "waiting") {
              console.log(user + ' left');
              msg.notify(user + ' left', event, function(err) {
                if (err) {
                  console.log(err);
                }

                // Notify polling clients
                notify();
              });
              delete users[user];
            }
          }, 2000);
        });

        console.log(user + ' joined');
        event = { type: 'join', usr: user };
        msg.notify(user + ' joined', event, function(err) {
          if (err) {
            console.log(err);
          }

          // Notify polling clients
          notify();
        });
      } else if (users[user] == "waiting") {
        users[user] = {
          name: user,
          last: new Date(),
          res: res
        };

        // When the user disconnects
        res.on('close', function() {
          users[user] = "waiting";

          setTimeout(function() {
            var event = { type: 'leave', usr: user };

            if (user in users && users[user] == "waiting") {
              console.log(user + ' left');
              msg.notify(user + ' left', event, function(err) {
                if (err) {
                  console.log(err);
                }

                // Notify polling clients
                notify();
              });
              delete users[user];
            }
          }, 2000);
        });
      } else {
        res.send(400, "User already exists");
      }
    } else {
      res.send(400, "Register name first");
    }
  } else {
    res.send(400, "Provide user name");
  }
});

app.post('/message', function(req, res) {
  var user, message, event;

  if ('user' in req.body && 'message' in req.body) {
    user = sanitize(req.body.user.toString()).xss();
    user = sanitize(user).entityEncode();
    user = sanitize(user).trim();
    message = sanitize(req.body.message.toString()).xss();
    message = sanitize(message).entityEncode();
    message = sanitize(message).trim();
    if (user in users) {
      if (message.match('^/me ') && message.length > 1) {
        event = { type: 'user event', usr: user };
          message = user + message.substr(3)
        msg.notify(message, event, function(err) {
          if (err) {
            console.log(err);
          }

          // Notify polling clients
          notify();
        });
      } else {
        msg.post(user, message, function(err) {
          if (err) {
            console.log(err);
          }

          // Notify polling clients
          notify();
        });
      }

      console.log(user + ' posted: ' + message);
      res.send(200);
    } else {
      res.send(400, "Unknown user");
    }
  } else {
    res.send(400, "Provide user name and message");
  }
});

msg.connectToDb(app.get('database'), function(err) {
  if (err) {
    console.log(err);
  } else {
    app.listen(app.get('server').port);
    console.log('Listening on port ' + app.get('server').port);
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

function getUsers() {
  var names = [];
  for (user in users) {
    if (users[user] != "pending") {
      names.push(user);
    }
  }
  return names;
}
