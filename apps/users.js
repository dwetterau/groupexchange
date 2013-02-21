// Users.js - user management api calls 

var auth = require('./auth');
var db = require('../db');
var utils = require('../utils');
var check = require('../validate').check;
var nano = db.nano;

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

function attachBasicPermissions(object) {
    permissions = {
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
    };
    object.permissions = permissions;
}

function makeBasicProfile(object, res) {
    db.personal.insert(object, object.username, function(err, body) {
        if (!err) {
            res.send({success: true});
        } else {
            res.send({error: err, success: false});
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
        db.personal.get(username, function(err, doc) {
            if (err) {
                res.send({error: err, success: false});
            } else {
                if (req.user.username !== username) {
                    //TODO add check to see if they are "partners"
                    for (var attr in doc.permissions["global"]) {
                        if (!doc.permissions["global"][attr]) {
                            doc[attr] = undefined;
                        }
                    }
                }
                utils.cleanDoc(doc);
                res.send({user: doc, success: true});
            }
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
                       var newUser = {
                           username: pid.toString(),
                           email: email,
                           password: hashed_pass,
                           salt: salt,
                           reputation: 0
                       };
                       db.users.insert(newUser, email, function(err, body) {
                           if (!err) {
                               personal_object = {
                                   username: pid.toString(),
                                   email: email
                               };
                               attachBasicPermissions(personal_object);
                               makeBasicProfile(personal_object, res);
                           } else {
                               res.send({error: 'Unable to make account at this time', 
                                         success: false});
                           }
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
        if (firstname) {
            allNull = false;
            try {
                check(firstname, "name");
            } catch (e) {
                res.send({error: e, success: false});
                return;
            }
        }
        if (lastname) {
            allNull = false;
            try {
                check(lastname, "name");
            } catch (e) {
                res.send({error: e, success: false});
                return;
            }
        }
        if (email) {
            allNull = false;
            try {
                check(email, "email");
            } catch (e) {
                res.send({error: e, success: false});
                return;
            }
        }
        if (allNull) {
            res.send({error: "Nothing to update", success: false});
            return;
        }
        db.personal.get(username, function(err, body) {
            if (err) {
                object = {
                    username: username,
                    firstname: firstname,
                    lastname: lastname,
                    email: email
                };
                db.personal.insert(object, username, function(err, body) {
                    if (err) {
                        res.send({error: err, success: false});
                    } else {
                        res.send({success: true});
                    }
                });
            } else {
                if (firstname) {
                    body.firstname = firstname;
                }
                if (lastname) {
                    body.lastname = lastname;
                }
                if (email) {
                    body.email = email;
                }
                db.personal.insert(body, username, function(err, body) {
                    if (err) {
                        res.send({error: err, success: false});
                    } else {
                        res.send({success: true});
                    }
                });
            }
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
