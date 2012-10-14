/**
* Node Simple Chat
* Client implementation
* Author: Johann-Michael Thiebaut <johann.thiebaut@gmail.com>
*/

var user, users, userCount, chatDisplayed,
    lastMessage, ajaxConnect, ajaxPoll;

function init() {
  user = null;
  users = {};
  userCount = 0;
  chatDisplayed = false;
  lastMessage = new Date();
  ajaxConnect = null;
  ajaxPoll = null;
}

function initConnectForm(flashMessage) {
  $("body > *").remove();

  $("body").append('<div id="connect">' +
      '<div id="intro">' +
      'This is <em>Node Simple Chat</em>, a simple chat' +
      'room written in javascript.' +
      '</div>' +
      '<form id="connectform">' +
        '<label for="connectuser">Username</label>' +
        '<input id="connectuser" type="text" name="user" placeholder="Type your username here" value="" />' +
        '<input type="submit" value="Connect" />' +
      '</form>' +
      '<div id ="connectdiv"></div>' +
    '</div>');

  if (flashMessage != null && flashMessage != "") {
    $("#intro").after('<div id="connectflash" class="flash">' + flashMessage + '</div>');
  }

  $("#connectform > :input:first").focus();

  $("#connectform").submit(function() {
    register($("#connectform > :input:first").val());
    return false;
  });
}

function removeConnectForm() {
  $("#connect").remove();
}

function register(username) {
  if (username == null || username == "") {
    $("#connectdiv").text("Enter a username!").show().fadeOut(2000);
  } else {
    $.ajax({
      url: "/user",
      dataType: "json",
      data: { user: username },
      type: "POST",
      complete: function(jqXHR, textStatus) {
        if (jqXHR.status == 400) {
          $("#connectdiv").text(jqXHR.responseText).show().fadeOut(2000);
        } else {
          removeConnectForm();
          user = username;
          connect(username);
        }
      }
    });
  }
}

function connect(user) {
  var start = new Date();

  ajaxConnect = $.ajax({
    url: "/connect",
    dataType: "json",
    data: { user: user },
    type: "POST",
    complete: function(jqXHR, textStatus) {
      var time = (new Date() - start);
      if (jqXHR.status == 400) {
        init();
        $("#connectdiv").text(jqXHR.responseText).show().fadeOut(2000);
      } else if (jqXHR.status == 0 || jqXHR.status == 504) {
        if (time < 5000) {
          close();
          initConnectForm("Disconnected from the server");
        } else {
          connect(user);
        }
      }
    }
  });

  if (!chatDisplayed) {
    chatDisplayed = true;
    initChat();
  }
}

function initChat() {
  $("body").append('<form id="chatform">' +
      '<input type="text" name="msg" placeholder="Type your message here" autocomplete="off" value="" />' +
      '<input type="submit" value="Send" />' +
    '</form>' +
    '<div id ="chatinfo">Users: <ul class="users"></ul></div>' +
    '<div id ="chatdisplay"></div>');

  $("#chatform > :input:first").focus();

  $("#chatform").submit(function() {
    postMessage($("#chatform > :input:first").val(), function() {
      $("#chatform > :input:first").val("");
      $("#chatform > :input:first").focus();
    });
    return false;
  });

  initMessages();
}

function initMessages() {
  $.ajax({
    url: "/messages",
    type: "GET",
    complete: function(jqXHR, textStatus) {
      var data;

      if (jqXHR.status == 200) {
        data = JSON.parse(jqXHR.responseText);
        if ('users' in data && 'messages' in data) {
          data.users.forEach(addUser);
          lastMessage = new Date(data.messages[0].date);
          data.messages.reverse().forEach(function(message) {
            displayMessage(message, false)
          });

          pollMessages();
        } else {
          close();
          initConnectForm("Error while retrieving messages: " + jqXHR.responseText);
        }
      } else {
        close();
        initConnectForm("Error while retrieving messages: " + jqXHR.responseText);
      }
    }
  });
}

function pollMessages() {
  var start = new Date();

  ajaxPoll = $.ajax({
    url: "/next-messages?d=" + lastMessage.getTime(),
    type: "GET",
    complete: function(jqXHR, textStatus) {
      var time = (new Date() - start), data;

      if (jqXHR.status == 200) {
        data = JSON.parse(jqXHR.responseText);
        if ('messages' in data) {
          lastMessage = new Date(data.messages[0].date);
          data.messages.reverse().forEach(function(message) {
            displayMessage(message, true)
          });

          pollMessages();
        } else {
          close();
          initConnectForm("Error while retrieving messages: " + jqXHR.responseText);
        }
      } else if (jqXHR.status == 0 || jqXHR.status == 504) {
        if (time < 5000) {
          close();
          initConnectForm("Disconnected from the server");
        } else {
          pollMessages();
        }
      } else {
        close();
        initConnectForm("Error while retrieving messages: " + jqXHR.responseText);
      }
    }
  });
}

function postMessage(message, callback) {
  $.ajax({
    url: "/message",
    dataType: "json",
    data: { user: user, message: message },
    type: "POST",
    complete: function(jqXHR, textStatus) {
      if (jqXHR.status == 200) {
        callback();
      } else {
        close();
        initConnectForm("Error while posting message: " + jqXHR.responseText);
      }
    }
  });
}

function addUser(user) {
  var uid;

  if (!(user in users)) {
    userCount++;
    users[user] = userCount;
    uid = "user" + userCount;
    $("#chatinfo .users").append('<li id="' + uid + '">' +
      user + '</li>');
  }
}

function deleteUser(user) {
  var uid;

  if (user in users) {
    uid = "#user" + users[user];
    $(uid).remove();
    delete users[user];
  }
}

function displayMessage(message, userChange) {
  var usr = message.usr,
      msg = message.msg,
      date = new Date(message.date);

  if (userChange == undefined) {
    userChange = true;
  }

  if (usr == null) {
    $("#chatdisplay").prepend('<div class="message">' +
        '<span class="date">' + dateString(date) + '</span>'+
        ' <span class="time">' + timeString(date) + '</span>'+
        ' <span class="notification">' + msg + '</span>' +
      '</div>');

    if (userChange) {
      if (message.event.type == "join") {
        addUser(message.event.usr);
      } else if (message.event.type == "leave") {
        deleteUser(message.event.usr);
      }
    }
  } else {
    $("#chatdisplay").prepend('<div class="message">' +
        '<span class="date">' + dateString(date) + '</span>'+
        ' <span class="time">' + timeString(date) + '</span>'+
        ' <span class="user">' + usr + '</span>' +
        ' <span class="message">' + msg + '</span>' +
      '</div>');
  }
}

function close() {
  if (ajaxConnect != null) {
    ajaxConnect.complete = function(jqXHR, textStatus) {};
    ajaxConnect.abort();
  }
  if (ajaxPoll != null) {
    ajaxPoll.complete = function(jqXHR, textStatus) {};
    ajaxPoll.abort();
  }

  init();
}

function timeString(date) {
  return twoDigits(date.getHours()) +
    ":" + twoDigits(date.getMinutes()) +
    ":" + twoDigits(date.getSeconds());
}

function dateString(date) {
  return twoDigits(date.getMonth()) +
    "/" + twoDigits(date.getDate()) +
    "/" + date.getFullYear();
}

function twoDigits(n) {
  return (n < 10 ? "0" : "") + n;
}

$(document).ready(function () {
  init();
  initConnectForm("");
});

$(window).unload(function() {
  close();
});
