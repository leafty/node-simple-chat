var mongo = require('mongodb');
var Server = mongo.Server;
var Db = mongo.Db;

var server = null;
var db = null;
var collection = null;

function connectToDb (config, callback) {
  var callback2;

  server = new Server(config.host, config.port, config.params);
  db = new Db(config.db, server, { safe: true });

  if (typeof callback != 'function') {
    callback2 = function(err) {};
  } else {
    callback2 = function(err) {
      process.nextTick(function() {
        callback(err);
      })
    };
  }

  db.open(function(err, db) {
    if(err) {
      console.log("Failed to connect to the database");
      callback2(err);
    } else {
      console.log("Connected to database");
      db.createCollection('messages', function(err, coll) {
        if (err) {
          callback2(err);
        } else {
          collection = coll
          collection.ensureIndex('date', function(err) {
            callback2(err);
          });
        }
      });
    }
  });
}

post = function post(user, message, callback) {
  var callback2;

  if (typeof callback != 'function') {
    callback2 = function(err) {};
  } else {
    callback2 = function(err) {
      process.nextTick(function() {
        callback(err);
      })
    };
  }

  if (collection == null) {
    callback2(new Error("Database is not open!"));
  } else {
    var doc = { usr: user, msg: message, date: new Date() };
    collection.insert(doc, function(err, result) {
      callback2(err);
    });
  }
};

notify = function notify(message, callback) {
  post(null, message, callback);
};

function getLastMessages(n, callback) {
  var callback2;

  if (typeof callback != 'function') {
    callback2 = function(err, docs) {};
  } else {
    callback2 = function(err, docs) {
      process.nextTick(function() {
        callback(err, docs);
      })
    };
  }

  if (collection == null) {
    callback2(new Error("Database is not open!"));
  } else {
    var params = { limit: n, sort: {date: -1} };
    collection.find({}, params, function(err, cursor) {
      cursor.toArray(callback2);
    });
  }
}

function getMessagesSince(date, callback) {
  var callback2;

  if (typeof callback != 'function') {
    callback2 = function(err, docs) {};
  } else {
    callback2 = function(err, docs) {
      process.nextTick(function() {
        callback(err, docs);
      })
    };
  }

  if (collection == null) {
    callback2(new Error("Database is not open!"));
  } else {
    var query = { date: { $gt: date } };
    var params = { limit: 50, sort: {date: -1} };
    collection.find(query, params, function(err, cursor) {
      cursor.toArray(callback2);
    });
  }
}

exports.connectToDb = connectToDb;
exports.post = post;
exports.notify = notify;
exports.getLastMessages = getLastMessages;
exports.getMessagesSince = getMessagesSince;
