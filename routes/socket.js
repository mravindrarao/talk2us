// Keep track of which names are used so that there are no duplicates
var userNames = (function () {
  var names = {};

  var claim = function (name) {
    if (!name || names[name]) {
      return false;
    } else {
      names[name] = true;
      return true;
    }
  };

  // find the lowest unused "guest" name and claim it
  var getGuestName = function () {
    var name,
      nextUserId = 1;

    do {
      name = 'Guest ' + nextUserId;
      nextUserId += 1;
    } while (!claim(name));

    return name;
  };

  // serialize claimed names as an array
  var get = function () {
    var res = [];
    for (user in names) {
      res.push(user);
    }

    return res;
  };

  var free = function (name) {
    if (names[name]) {
      delete names[name];
    }
  };

  return {
    claim: claim,
    free: free,
    get: get,
    getGuestName: getGuestName
  };
}());

// export function for listening to the socket
module.exports = function (socket) {
  var name = userNames.getGuestName();

  // send the new user their name and a list of users
  socket.emit('init', {
    name: name,
    users: userNames.get()
  });

  // notify other clients that a new user has joined
  socket.broadcast.emit('user:join', {
    name: name
  });

  // broadcast a user's message to other users
  socket.on('send:message', function (data) {
    socket.broadcast.emit('send:message', {
      user: name,
      text: data.message
    });
      console.log(data);
  });

  // validate a user's name change, and broadcast it on success
  socket.on('change:name', function (data, fn) {
    if (userNames.claim(data.name)) {
      var oldName = name;
      userNames.free(oldName);

      name = data.name;
      
      socket.broadcast.emit('change:name', {
        oldName: oldName,
        newName: name
      });

      fn(true);
    } else {
      fn(false);
    }
  });

  // clean up when a user leaves, and broadcast it to other users
  socket.on('disconnect', function () {
    socket.broadcast.emit('user:left', {
      name: name
    });
    userNames.free(name);
  });

  //adding webRTC related messages
  socket.on('ROOM', function (msg) {
    if (getConnInfo(connection)) {
        debug('ROOM request sent from existing connection');
        return;
    }
    var connInfo = new ConnInfo(connection, msg.role,
        msg.room, null);
    connList.push(connInfo);
    debug('New ' + msg.role + ' connection in room ' + msg.room);
  });

  socket.on('OFFER', function (msg) {
    senderInfo = getConnInfo(connection);
    if (!senderInfo) {
        debug('Offer received from unknown connection');
        return;
    }
    if (senderInfo.role !== 'client') {
        debug('Exception: only CLIENT can make offer');
        return;
    }
    debug('Offer from ' + senderInfo.role +
        ' in room ' + senderInfo.room);

    receiverInfo = getAvailableProvider(senderInfo.room);
    if (!receiverInfo) {
        debug('No provider found in room ' + senderInfo.room);
        listConnInfo();
        return;
    }
    senderInfo.other = receiverInfo.conn;
    receiverInfo.other = senderInfo.conn;
    receiverInfo.conn.send(JSON.stringify(msg));
  });

  socket.on('ANSWER', function (msg) {
        senderInfo = getConnInfo(connection);
        if (!senderInfo) {
            debug('Answer received from unknown connection');
            return;
        }
        senderInfo.other.send(JSON.stringify(msg));
    });

  socket.on('CANDIDATE', function (msg) {
        senderInfo = getConnInfo(connection);
        if (!senderInfo) {
            debug('Candidate received from unknown connection');
            return;
        }
        if (!senderInfo.other) {
            debug('Peer unknown for sending candidate');
            return;
        }
        senderInfo.other.send(JSON.stringify(msg));
    });

  socket.on('HANGUP', function (msg) {
        senderInfo = getConnInfo(connection);

    if (!senderInfo) {
        debug('Hangup received from unknown connection');
        return;
    }
    if (!senderInfo.other) {
        debug('Peer unknown for sending hangup');
        return;
    }
    receiverInfo = getConnInfo(senderInfo.other);
    senderInfo.other.send(JSON.stringify(msg));
    // Remove the pairing information
    if (receiverInfo) {
        receiverInfo.other = null;
    } else {
        debug('Recepient for hangup not registered');
    }
    senderInfo.other = null;
    });


  function ConnInfo(connection, role, room, other) {
      this.conn = connection;
      this.role = role;
      this.room = room;
      this.other = other;
  }

  function getConnInfo(conn) {
      for (var i = 0; i < connList.length; i++) {
          if (connList[i].conn == conn) {
              break;
          }
      }
      if (i === connList.length) {
          return null;
      } else {
          return connList[i];
      }
  }

  function removeConnInfo(conn) {
      for (var i = 0; i < connList.length; i++) {
          if (connList[i].conn == conn) {
              break;
          }
      }
      if (i < connList.length) {
          debug('Removing ' + connList[i].role + ' in room ' + connList[i].room);
          connList.splice(i, 1);
      } else {
          debug('Connection not found for deletion');
      }
  }

  function listConnInfo() {
      debug('Number of registered connections is ' + connList.length);
      for (var i = 0; i < connList.length; i++) {
          debug(+i + ': ' + connList[i].role + ' in room ' + connList[i].room);
      }
  }

  function getAvailableProvider(room) {
      for (var i = 0; i < connList.length; i++) {
          if (connList[i].role === 'provider' &&
              connList[i].room === room &&
              connList[i].other == null) {
              break;
          }
      }
      if (i === connList.length) {
          return null;
      } else {
          return connList[i];
      }
  }
};
