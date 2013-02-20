var express = require('express');
var connect = require('connect');
var check = require('./validate').check;

var auth = require('./apps/auth');
var db = require('./db');
var utils = require('./utils');

var userdb = db.users;
var transactiondb = db.transactions;
var groupdb = db.groups;
var groupmembersdb = db.groupmembers;
var personaldb = db.personal;
var privacydb = db.privacy;
var nano = db.nano;

var app = express();

// Configure session store
var ConnectCouchDB = require('connect-couchdb')(connect);
var store = new ConnectCouchDB({name: 'sessions'});

app.configure(function() {
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(connect.session({
        secret: '54b20410-6b04-11e2-bcfd-0800200c9a66',
        store: store
    }));
    app.use(express.static(__dirname + '/public'));
	app.use('/lib', express.static(__dirname + '/client_lib'));
    app.use(express.limit('5mb')); //Limiting max form size for photo uploads
});

// Install app routes
var users = require('./apps/users');
users.install_routes(app);

var groups = require('./apps/groups');
groups.install_routes(app);

var transactions = require('./apps/transactions');
transactions.install_routes(app);

app.post('/login', function(req, res) {
    var username = req.body.username.toLowerCase();
    var pass = req.body.password;

    try {
        check(username, "username");
        check(pass, "password");
    } catch (e) {
        res.send({error: e.message, success: false});
        return;
    }
    
    var response = {logged_in: false};
    userdb.get(username, function (err, body) {
        if (!err) {
            //check the password
            auth.hash_password(pass, body.salt, function(hashed_pass) {
                if (body.password == hashed_pass) {
                    req.session.user_id = username;
                    response.logged_in = true;
                    response.username = username;
                } else {
                    response.error = 'Invalid username or password';
                }
                //if (remember me checked)
                req.session.maxAge = 604800; // one week
                response.success = true;
                res.send(response);
            });
        } else {
            //Couldn't find it in database OR database is unavailable
            response.error = 'Invalid username or password';
            response.success = false;
            res.send(response);
        }
    });
});

app.get('/logout', auth.checkAuth, function(req, res) {
    delete req.session.user_id;
    res.send({success: true});
});



app.listen(3000);
console.log('Server started');
