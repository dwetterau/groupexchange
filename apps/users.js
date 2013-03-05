// Users.js - user management api calls 

var db = require('../db');
var utils = require('../utils');
var check = require('../validate').check;
var _ = require('underscore')._;
var nano = db.nano;

exports.install_routes = function(app) {
    var auth = require('./auth')(app.User);
    app.get('/user/:id', auth.checkAuth, function(req, res) {
        var id = req.params.id;
        // If we get a request for "me", then send back the logged in users information
        if (id === 'me') {
            id = req.user.get('id');
        }
        var personal = app.Personal.load(id).then(function() {
            if (req.user.get('id') !== id) {
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
        }).fail(function(err) {
            res.send({error: err, success: false});
        });
    });

    app.post('/makeaccount', function(req, res) {
        var email = req.body.email.toLowerCase();
        var pass = req.body.password;

        try {
            check(email, 'email');
        } catch (e) {
            res.send({error: e.message, success: false});
            return;
        }

        var salt = auth.generateSalt(128);
        auth.hash_password(pass, salt, function(hashed_pass) {
            //create the account
            var new_user = app.User.create({
                email: email,
                password: hashed_pass,
                salt: salt,
                reputation: 0,
                // TODO: Get default stuff in models to avoid this nonsense
                permissions: {
                    global: {
                        firstname: true,
                        lastname: false,
                        email: false,
                        username: true,
                        reputation: true
                    },
                    partners: {
                        firstname: true,
                        lastname: true,
                        email: true,
                        username: true,
                        reputation: true
                    }
                }
            }).then(function(user) {
                console.log("making personal");
                var personal = app.Personal.create({
                    id: user.get('id').toString(),
                    email: email
                }).then(function() {
                    res.send({success: true});
                }).fail(function() {
                    res.send({error: err, success: false});
                });
            }).fail(function(err) {
                res.send({error: 'Unable to make account at this time', 
                          success: false});
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
