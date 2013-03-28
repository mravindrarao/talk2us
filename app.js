
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
  , LocalStrategy = require('passport-local').Strategy;

var db;

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

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
mongoose.disconnect();


function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.redirect('/login');
}


function authenticateWithDatabase (user, pass, fn) {
    if (!db) {
        db = mongoose.connect('mongodb://localhost/useradmin');
        mongoose.model('User', 
		               new Schema({'username': String, 'password': String}), 
		               'Users');
    }
    console.log('User: ' + user + ', Password: ' + pass);

    var User = mongoose.model('User');

	User.findOne({username: user}, function(err, doc) {
        console.log("Callback called");
        if (err) {
            console.log(err.toString());
        }
		console.log(doc);
		if (err || !doc || doc.password != pass) {
			return fn(null, null);
		}
        return fn(null, doc);
	});
}

function findById(id, fn) {
    var User = mongoose.model('User');
    User.findOne({_id: id }, function(err, doc) {
        fn(err, doc);
    });

}


passport.use(new LocalStrategy(
    function(username, password, done) {
        process.nextTick(function() {
            authenticateWithDatabase(username, password, function(err, user) {
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


passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  findById(id, function (err, user) {
    done(err, user);
  });
});

