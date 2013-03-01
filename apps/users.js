// Users.js - user management api calls 

var auth = require('./auth');
var db = require('../db');
var utils = require('../utils');
var check = require('../validate').check;
var _ = require('underscore')._;
var nano = db.nano;

exports.install_routes = function(app) {
    app.get('/user/:username', auth.checkAuth, function(req, res) {
        var username = req.params.username;
        // If we get a request for "me", then send back the logged in users information
        if (username === 'me') {
            username = req.user.username;
        }
        var personal = new app.Personal(username);
        personal.load(function(doc) {
            if (req.user.username !== username) {
                //TODO add check to see if they are "partners"
                for (var attr in personal.get('permissions').global) {
                    if (!personal.get('permissions').global[attr]) {
                        personal.set(attr, undefined);
                    }
                }
            }
            var cleaned = personal.toJSON();
            utils.cleanDoc(cleaned);
            res.send({user: cleaned, success: true});
        }, function(err) {
            res.send({error: err, success: false});
        });
    });

    app.post('/makeaccount', function(req, res) {
        app.bucket.incr('user::count', function(err, pid) { 
            if (err) {
                res.send({error: err, success: false});
                return;
            }
                
            console.log(pid);
            var email = req.body.email.toLowerCase();
            var pass = req.body.password;

            try {
                check(pid, 'pid');
                check(email, 'email');
            } catch (e) {
                res.send({error: e.message, success: false});
                return;
            }

            var salt = auth.generateSalt(128);
            auth.hash_password(pass, salt, function(hashed_pass) {
                //create the account
                var new_user = new app.User(email);
                new_user.update({
                    username: pid.toString(),
                    email: email,
                    password: hashed_pass,
                    salt: salt,
                    reputation: 0
                });
                // TODO: Create create function calls
                new_user.save(function() {
                    var personal = new app.Personal(pid.toString());
                    personal.update({
                        username: pid.toString(),
                        email: email
                    });
                    personal.save(function() {
                        res.send({success: true});
                    }, function(err) {
                        res.send({error: err, success: false});
                    });
                }, function(err) {
                    res.send({error: 'Unable to make account at this time', 
                              success: false});
                });
            });
        });
    });

    app.post('/updateprofile', auth.checkAuth, function(req, res) {
        var username = req.user.username;
        var firstname = req.body.firstname;
        var lastname = req.body.lastname;
        var email = req.body.email;

        var allNull = true;
        var update_type_map = {"firstname": "name", "lastname": "name"};
        //TODO allow updating of username/email...
        var updates = {};
        for (var attr in req.body) {
            if (attr in update_type_map && req.body[attr]) {
                allNull = false;
                try {
                    check(req.body[attr], update_type_map[attr]);
                    updates[attr] = req.body[attr];
                } catch (e) {
                    res.send({error: e, success: false});
                    return;
                }
            }
        }
        if (allNull) {
            res.send({error: "Nothing to update", success: true});
            return;
        }
        var personal = new app.Personal(username);
        personal.load(function() {
            personal.update(updates);
            personal.save(function() {
                res.send({success: true});
            }, function(err) {
                res.send({error: err, success: false});
            });
        }, function(err) {
            res.send({error: err, success: false});
        });

    });

    app.post('/uploadphoto', auth.checkAuth, function(req, res) {
        res.send({success: true});
        console.log('uploaded ' + req.files.image.name);
        console.log(req.files.image.size / 1024 | 0);
        console.log(req.files.image.path);
        console.log(req.body.title);
    });
};
