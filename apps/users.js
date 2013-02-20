// Users.js - user management api calls 

var auth = require('./auth');
var db = require('../db');
var utils = require('../utils');
var check = require('../validate').check;

//New stuff I'll have to move over ======================================
// This is serialized for now.. I'll probably want to change that
function getNewPID(callback) {
    db.users.get('c', function(err, body) {
        if (err) {
            //Start a new counter. This should only happen once
            db.nano.get('users', function(err, body) {
                var num = body.doc_count;
                if (err) {
                    //TODO... um crap
                } else {
                    userdb.insert({num: num}, 'c', function(err, body) {
                        if (err) {
                            //TODO... redo?
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

function makeBasicPermissions(username, personal_object, res, callback) {
    object = {
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
    db.privacy.insert(object, username, function(err, body) {
        if (!err) {
            callback(username, personal_object, res);
        } else {
            res.send({error: err, success: false});
        }
    });
}

function makeBasicProfile(username, object, res) {
    db.personal.insert(object, username, function(err, body) {
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
        if (req.user.username !== username) {
            res.send({error: 'Other profile viewing not implemented yet', success: false});
        }
        db.personal.get(username, function(err, doc) {
            if (err) {
                res.send({error: err, success: false});
            } else {
                utils.cleanDoc(doc);
                res.send({user: doc, success: true});
            }
        });
    });

    app.post('/makeaccount', function(req, res) {
        var username = req.body.username.toLowerCase();
        var email = req.body.email.toLowerCase();
        var pass = req.body.password;

        try {
            check(username, 'username');
            check(email, 'email');
        } catch (e) {
            res.send({error: e.message, success: false});
            return;
        }
        
        db.users.head(username, function(err, body) {
            if (!err) {
                res.send({error: 'Username is already in use', success: false});
            } else {
                var salt = auth.generateSalt(128);
                auth.hash_password(pass, salt, function(hashed_pass) {
                    //create the account
                    var newUser = {
                        username: username,
                        email: email,
                        password: hashed_pass,
                        salt: salt,
                        reputation: 0
                    };
                    db.users.insert(newUser, username, function(err, body) {
                        if (!err) {
                            console.log('Made new user='+username);
                            personal_object = {
                                username: username,
                                email: email
                            };
                            makeBasicPermissions(username, personal_object, 
                                                 res, makeBasicProfile);
                        } else {
                            res.send({error: 'Unable to make account at this time', 
                                      success: false});
                        }
                    });
                });
            }
        });
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

    app.post('/updatepermissions', auth.checkAuth, function(req, res) {
        res.send("NOT IMPLEMENTED"); //TODO: Implement this
    });
};
