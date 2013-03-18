var express = require('express');
var connect = require('connect');
var db = require('./db');
var models = require('./apps/models');
var app = express();
var cluster = require('cluster');


db.ready(function(bucket) {
    app.bucket = bucket;
    var store = require('./session-store/couchbase-store')(connect, bucket);
    app.configure(function() {
        app.use(express.bodyParser());
        app.use(express.cookieParser());
        app.use(connect.session({
             secret: '54b20410-6b04-11e2-bcfd-0800200c9a66',
             store: new store({})
        }));
        app.use(express.static(__dirname + '/public'));
	    app.use('/lib', express.static(__dirname + '/client_lib'));
        app.use(express.limit('5mb')); //Limiting max form size for photo uploads
    });

    // Open db
    models.install_models(bucket, app);
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
});
