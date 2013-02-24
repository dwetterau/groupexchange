// Users.js - user management api calls 

var auth = require('./auth');
var db = require('../db');
var utils = require('../utils');
var check = require('../validate').check;
var _ = require('underscore')._;
var nano = db.nano;
var models = require('./models');

// This is serialized for now.. I'll probably want to change that
function getNewPID(callback) {
    db.users.get('c', function(err, body) {
        if (err) {
            //Start a new counter. This should only happen once
            nano.db.get('users', function(err, body) {
                var num = body.doc_count;
                if (err) {
                    //Also should never happen
                } else {
                    db.users.insert({num: num}, 'c', function(err, body) {
                        if (err) {
                            //Should never happen
                        } else {
                            callback(num);
                        }
                    });
                }
            });
        } else {
            body.num += 1;
            var num = body.num;
            db.users.insert(body, 'c', function(err, body) {
                if (err) {
                    //try again
                    getNewPID(callback);
                } else {
                    callback(num);
                }
            });
        }
    });
}

exports.install_routes = function(app) {
    app.get('/user/:username', auth.checkAuth, function(req, res) {
        var username = req.params.username;
        // If we get a request for "me", then send back the logged in users information
        if (username === 'me') {
            username = req.user.username;
        }
        var personal = new models.Personal(username);
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
        // Just btw, pid = profile id
        createAccount = function(pid) { 
           var email = req.body.email.toLowerCase();
           var pass = req.body.password;

           try {
               check(pid, 'pid');
               check(email, 'email');
           } catch (e) {
               res.send({error: e.message, success: false});
               return;
           }
           
           db.users.head(email, function(err, body) {
               if (!err) {
                   res.send({error: 'Email is already in use', success: false});
               } else {
                   var salt = auth.generateSalt(128);
                   auth.hash_password(pass, salt, function(hashed_pass) {
                       //create the account
                       var new_user = new models.User(email);
                       new_user.update({
                           username: pid.toString(),
                           email: email,
                           password: hashed_pass,
                           salt: salt,
                           reputation: 0
                       });
                       new_user.save(function() {
                           var personal = new models.Personal(pid.toString());
                           personal.email = email;
                           personal_object = {
                               username: pid.toString(),
                               email: email
                           };
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
               }
           });
        };
        getNewPID(createAccount);
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
        var personal = new models.Personal(username);
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
