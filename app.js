
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
  , FacebookStrategy = require('passport-facebook').Strategy;

var db = mongoose.connect('mongodb://localhost/useradmin')
  , fbPrefix = '_fb_'
  , User;

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
  app.set('port', process.env.PORT || 3000);
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
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);

app.get('/login', function(req, res) {
    if (req.user) {
        res.redirect('/');
    } else {
        res.render('login');
    }
});
app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/login');
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
  console.log("Express server listening on port " + app.get('port'));
});


function authenticateWithDatabase (user, pass, fn) {
    console.log('User: ' + user + ', Password: ' + pass);

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
        callbackURL: "http://127.0.0.1:3000/auth/facebook/callback",
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
            var user = new User({ userid: id, display: displayName });
            user.save(fn(err, user, done));
        } else {
            if (err) {
                console.log(err.toString());
            }
            // TODO: check if display name has changed
            fn(err, doc, done);
        }
    });
}
