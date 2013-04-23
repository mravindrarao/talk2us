
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , FacebookStrategy = require('passport-facebook').Strategy
  , websocket = require('websocket')
  , jshare = require('jshare');

var db = mongoose.connect('mongodb://localhost/useradmin')
  , fbPrefix = '_fb_'
  , User;

var wsServer
  , httpSocketServer
  , sockServerPort = 3000
  , httpServerPort = 8080
  , connList = [];

var debugEnabled = true;

mongoose.model('User', 
		       new Schema({'userid': { type: String, index: { unique: true } },
                           'password': String, 
                           'display': String,
                           'email': String,
                           'role': String }), 
		       'Users');
User =  mongoose.model('User');

var app = express();


app.configure(function(){
  app.set('port', process.env.PORT || httpServerPort);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session({ cookie: { maxAge: 60000 }}));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(jshare('shared'));
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

var ensureAuthenticated = function(req, res, next){
    if ( !req.session.userid ) {
        req.session.redirect_to = req.path;
        res.redirect('/login');
    } else {
        next();
    }
};

app.get('/', routes.index);

app.get('/login', function(req, res) {
    var redirect_to = req.session.redirect_to ? req.session.redirect_to : '/';
    delete req.session.redirect_to;

    if (req.query.redirect_to)
        redirect_to = req.query.redirect_to;

    if (req.user) {
        res.redirect(redirect_to);
    } else {
        res.render('login-foundation');
    }
});
app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

app.post('/login',
         passport.authenticate('local', { failureRedirect: '/login' }),
         function(req, res) {
             res.redirect('/');
         });

app.get('/auth/facebook',
        passport.authenticate('facebook'),
        function(req, res) {
            // The request will be redirected to Facebook for authentication,
            // so this function will not be called
        });

app.get('/auth/facebook/callback', 
       passport.authenticate('facebook', { failureRedirect: '/login'}),
       function(req, res) {
           res.redirect('/');
       });
http.createServer(app).listen(app.get('port'), function(){
  debug("Express server listening on port " + app.get('port'));
});


passport.use(new LocalStrategy(
    function(userid, password, done) {
        process.nextTick(function() {
            authenticateWithDatabase(userid, password, function(err, user) {
                if (err)  { return done(err); }
                if (!user) {
                    return done(null, false,
                               { message: 'Incorrect username or password'});
                }
                return done(null, user);
            });
        });
    }
));


passport.use(
    new FacebookStrategy({
        clientID: '558449554176735',
        clientSecret: 'a5fe9b923933d36278a827e854ad82a7',
        callbackURL: "http://127.0.0.1:8080/auth/facebook/callback",
        profileFields: ['id', 'displayName']  },
                         function(accessToken, refreshToken, profile, done) {
                             process.nextTick(function() {
                                 //TODO: find out what is returned in profile
                                 if (profile) {
                                     addOrFind(fbPrefix + profile.id, 
                                               profile.displayName, 
                                               cbOnAuth, done);
                                 } else {
                                     var err = new Error('No Facebook profile found');
                                     cbOnAuth(err, null, done);
                                 }
                             });
                         }
                        ));

passport.serializeUser(function(user, done) {
  done(null, user.userid);
});

passport.deserializeUser(function(id, done) {
  findById(id, function (err, user) {
    done(err, user);
  });
});


/*
 * Websocket server for handling peer-to-peer signaling
 */

httpSocketServer = http.createServer(function(req, res) {
    return true;
});

httpSocketServer.listen(sockServerPort, function() {
    debug('Websocket server listening on port ' + sockServerPort);
});

wsServer = new websocket.server({
    httpServer: httpSocketServer,
    autoAcceptConnections: false
});


wsServer.on('request', function(request) {
   var conn = request.accept('talk2us', request.origin);
    debug('Connection from ' + conn.remoteAddress + ' accepted');

    conn.on('message', function(message) {
       if (message.type === 'utf8') {
           processMessage(this, message.utf8Data);
       } else if (message.type === 'binary'){
           debug('Received ' + message.binaryData.length +
                 ' bytes of binary data unexpectedly');
       } else {
           debug('Unexpected message type ' + message.type);
       }
    });

    conn.on('close', function(reasonCode, description) {
        debug('Closed connection ' + conn.remoteAddress + 
              ' reason ' + reasonCode);
        removeConnInfo(this);
        listConnInfo();
    });

    function processMessage(connection, data) {
        var conn = null
          , item = null
          , senderInfo = null
          , receiverInfo = null
          , msg = JSON.parse(data);

        debug('Received msg of type ' + msg.msg_type);
 
        switch(msg.msg_type) {

        case 'ROOM':
            if (getConnInfo(connection)) {
                debug('ROOM request sent from existing connection');
                return;
            }
            var connInfo = new ConnInfo(connection, msg.role, 
                                        msg.room, null);
            connList.push(connInfo);
            debug('New ' + msg.role + ' connection in room ' + msg.room);
            break;

        case 'OFFER':
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
            break;

        case 'ANSWER':
            senderInfo = getConnInfo(connection);
            if (!senderInfo) {
                debug('Answer received from unknown connection');
                return;
            }
            senderInfo.other.send(JSON.stringify(msg));
            break;

        case 'CANDIDATE':
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
            break;

        case 'HANGUP':
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
            break;

        default:
            debug('Unknown message type ' + msg.msg_type);
            break;
        }
    }
});


function authenticateWithDatabase (user, pass, fn) {
    debug('User: ' + user + ', Password: ' + pass);

	User.findOne({userid: user}, function(err, doc) {
		if (err || !doc || doc.password != pass) {
			return fn(null, null);
		}
        return fn(null, doc);
	});
}

function findById(id, fn) {
    var User = mongoose.model('User');
    User.findOne({userid: id }, function(err, doc) {
        fn(err, doc);
    });

}


function cbOnAuth(err, user, done) {
    if (err) return done(err);
    if (!user) {
        return done(null, false, { message: 'Incorrect username or password' });
    }
    return done(null, user);
}


function addOrFind(id, displayName, fn, done) {
    User.findOne({ userid: id }, function(err, doc) {
        if (!err && !doc) {
           // insert id and displayName in the db
            var user = new User({ userid: id, display: displayName, role: 'client' });
            user.save(fn(err, user, done));
        } else {
            if (err) {
                debug(err.toString());
            }
            // TODO: check if display name has changed
            fn(err, doc, done);
        }
    });
}


function debug(s) {
    if (debugEnabled) {
        console.log((new Date()) + ' ' + s);
    }
}

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

