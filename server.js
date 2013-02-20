var express = require('express');
var connect = require('connect');
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

var main = require('./apps/main');
main.install_routes(app);

// 3 - 2 - 1 Go!
app.listen(3000);
console.log('Server started');

