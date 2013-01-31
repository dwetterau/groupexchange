var express = require('express');
var connect = require('connect');
var auth = require('./auth');
var db = require('./db');

var userdb = db.users;
var transactiondb = db.transactions;
var groupdb = db.groups;
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
});

app.get('/secure', auth.checkAuth, function(req, res) {
    res.send('You are def logged in ' + req.user.firstname);
});

app.get('/user/:username', auth.checkAuth, function(req, res) {
    var username = req.params.username;
    userdb.get(username, function(err, doc) {
        if (err) {
            res.send('Bad');
        } else {
            res.send(JSON.stringify(doc));
        }
    });
});

app.get('/group/:name', auth.checkAuth, function(req, res) {
    // TODO: Add permissions checking
    var name = req.params.name;
    groupdb.get(name, function(err, doc) {
        if (err) {
            res.send('Bad');
        } else {
            res.send(JSON.stringify(doc));
        }
    });
});

app.post('/makeaccount', function(req, res) {
    var username = req.body.username.toLowerCase();
    var email = req.body.email.toLowerCase();
    var first = req.body.firstname;
    var last = req.body.lastname;
    var pass = req.body.password;

    if (username.length < 4 ||
        email.length === 0 ||
        first.length === 0 ||
        last.length === 0 ||
        pass.length === 0) {
        //TODO better account submission checking
        res.send('Bad form submission', 400);
        return;
    }
    
    userdb.head(username, function(err, body) {
        if (!err) {
            res.send('Username is already in use.', 200);
        } else {
            var salt = auth.generateSalt(128);
            auth.hash_password(pass, salt, function(hashed_pass) {
                //create the account
                var newUser = {
                    username: username,
                    email: email,
                    firstname: first,
                    lastname: last,
                    password: hashed_pass,
                    salt: salt,
                    reputation: 0
                };
                userdb.insert(newUser, username, function(err, body) {
                    if (!err) {
                        console.log('Made new user='+username);
                        res.send('Account created!', 200);
                    } else {
                        res.send('Unable to make account at this time.', 200);
                    }
                });
            });
        }
    });
});

app.post('/makegroup', auth.checkAuth, function(req, res) {
    var username = req.user.username;
    var display_groupname = req.body.groupname.toLowerCase();
    var groupname = escape(display_groupname);
    if (!groupname || groupname.length < 4) {
        res.send('Bad form submission', 200);
    }
    var group_name_combined = username + '-' + groupname; 
    groupdb.head(group_name_combined, function(err, body) {
        if (!err) {
            res.send('Groupname is in use.', 200); //Aka this user has already created a group with this name
        } else {
            var groupObject = {
                name: group_name_combined,
                display_name: display_groupname,
                owner: username,
                members: [username]
            };
            groupdb.insert(groupObject, group_name_combined, function(err, body) {
                if (!err) {
                    console.log('Made new group='+group_name_combined);
                    addUserToGroup(username, group_name_combined); 
                    res.send('Made group!', 200);
                } else {
                    res.send('Unable to make group at this time.', 200);
                }
            });
        }
    });
});



app.post('/addgroup', auth.checkAuth, function (req, res) {
    var username = req.user.username;
    var groupname = req.body.groupname.toLowerCase();
    if (!groupname || groupname.length < 9) {
        res.send('Bad form submission', 200);
    }
    groupdb.get(groupname, function(err, body) {
        if (err) {
            res.send('Unable to find group', 200);
        } else {
            var list = body.members;
            var found = false;
            for (var i = 0; i < list['length']; i++) {
                if (list[i] === username) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                body.members.push(username);
                groupdb.insert(body, groupname, function(err, body) {
                    if (err) {
                        res.send('Unable to add to group', 200);
                    } else {
                        addUserToGroup(username, groupname);
                        console.log('Added user to group='+groupname);
                        res.send('Successfully added user to group', 200);
                    }
                });
            } else {
                res.send('Already in group', 200);
            }
        }
    });
});

function addUserToGroup(username, groupname) {
    userdb.get(username, function(err, body) {
        if (!err) {
            if (!body.groups) {
                body.groups = [];
            }
            body.groups.push(groupname);
            userdb.insert(body, username, function(err, body) {
                if (!err) {
                    console.log("Successfully added group to user's account");
                }
            });
        }
    });
}

app.post('/login', function(req, res) {
    var username = req.body.username.toLowerCase();
    var pass = req.body.password;

    if (username.length == 0 || pass.length == 0) {
        //TODO better login submission checking
        res.send('Bad login submission', 400);
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
                res.send(JSON.stringify(response));
            });
        } else {
            //Couldn't find it in database OR database is unavailable
            response.error = 'Invalid username or password';
            res.send(JSON.stringify(response));
        }
    });
});

app.get('/logout', auth.checkAuth, function(req, res) {
    delete req.session.user_id;
    res.redirect(301, '/login');
});

app.post('/addtransaction', auth.checkAuth, function(req, res) {
    //The request will store the usernames of both of the parties in the transaction
    var username1 = req.body.username1.toLowerCase();
    var username2 = req.body.username2.toLowerCase();
    var amount = req.body.amount;
    var direction = req.body.direction === 'to_other'; //normal direction is from username1 to username2
    var createTime = new Date();
    var transactionObject = {
        username1: username1,
        username2: username2,
        amount: amount,
        direction: direction,
        //still need to set the transaction id
        status: 1, // user1 who made the transaction has approved it
        createTime : createTime,
        lastModifiedTime : createTime
    };

    if (req.body.details) {
        transactionObject.details = req.body.details;
    } 

    //retrieve both users from the userdb
    var user1, user2;
    // The structure is reversed so that the callbacks work in order to serialize
    // the data retrievals.
    var makeTransaction = function(num_transactions) {

        transaction_name =  username1 + '-' + username2 + '-' + num_transactions;
    
        console.log("Made new transasction="+transaction_name);
        transactionObject.id = transaction_name;
        if (!user1.transactions) {
            user1.transactions = [];    
        }
        if (!user2.transactions) { 
            user2.transactions = [];
        }
        user1.transactions.unshift(transaction_name);
        user2.transactions.unshift(transaction_name);

        //need to add the new transaction, then update the two user entries
        //TODO figure out how to roll back partial transactions 
        transactiondb.insert(transactionObject, transaction_name, function(err, body) {
            if (err) {
                res.send("Failed to add transaction.", 503);
            }
        });
        userdb.insert(user1, username1, function(err, body) {
            if (err) {
                //shit... should we try to remove the transaction or just leave it?
                res.send("Failed to add transaction.", 503);
            }
        });
        userdb.insert(user2, username2, function(err, body) {
            if (err) {
                //shit... should we try to remove the transaction or just leave it?
                res.send("Failed to add transaction.", 503);
            }  
        });
        res.send("Successfully made new transaction.", 200);
    };

    var getSecond = function() {
        userdb.get(username2, function (err, body) {
            if (!err) {
                user2 = body;
                numTransactions(makeTransaction);
            } else {
                res.send("Retrieval failed.", 503);
            }
        });
    };
    
    userdb.get(username1, function (err, body) {
        if (!err) {
            user1 = body;
            getSecond();
        } else {
            res.send("Retrieval failed.", 503);
        }
    });
});


function numTransactions(callback) {
    nano.db.get('transactions', function(err, body) {
        if (!err) {
            callback(body.doc_count);
        } else {
            callback(-1);
        }
    });
}

app.post('/userinfo', auth.checkAuth, function(req, res) {
    var user_sender = req.body.usersender.toLowerCase();
    var user_target = req.body.usertarget.toLowerCase();

    if (user_sender.length == 0 || user_target.length == 0) {
        //TODO better login submission checking
        res.send('Bad userinfo submission', 400);
        return;
    }
    
    userdb.get(user_target, function (err, body) {
        if (!err) {
            user_object = {
                username: body.username,
                firstname: body.firstname,
                reputation: body.reputation
                };
            if (user_sender === user_target) {
                //realease all private info TODO make this not spoofable
                user_object.lastname = body.lastname;
                user_object.transactions = body.transactions;
                user_object.email = body.email;
                user_object.groups = body.groups;
            }
            console.log("Retrieved user data for user="+body.username);
            res.send(user_object, 200);
        } else {
            res.send('Unable to find user', 200);
        }
    });
});

app.post('/transactioninfo', auth.checkAuth, function(req, res) {
    var username = req.body.username.toLowerCase();
    var transaction = req.body.transaction;

    if (username.length == 0 || transaction.length == 0) {
         //TODO better login submission checking
        res.send('Bad transactioninfo submission', 400);
        return;
    }
    transactiondb.get(transaction, function (err, body) {
        if (!err) {
            if (!(username === body.username1 || username === body.username2)) {
                //User shouldn't see it even though it was found
                res.send('Unable to find transaction', 200);                
                return;
            }
            console.log("Retrieved transaction data for transaction="+transaction);
            //Copy body into another object so we don't get private CouchDB stuff
            var transactionObject = {
                username1: body.username1,
                username2: body.username2,
                amount: body.amount,
                direction: body.direction,
                status: body.status, // user1 who made the transaction has approved it
                id : body.id,
                details: body.details,
                createTime: body.createTime,
                lastModifiedTime: body.lastModifiedTime
            };
            res.send(transactionObject, 200);
        } else {
            res.send('Unable to find transaction', 200);
        }   
    });
});

app.post('/groupinfo', auth.checkAuth, function(req, res) {
    var username = req.user.username;
    var groupname = req.body.groupname.toLowerCase();
    //TODO param checking
    groupdb.get(groupname, function (err, body) {
        if (!err) {
            var list = body.members;
            var found = false;
            for (var i = 0; i < list['length']; i++) {
                if (list[i] === username) {
                    found = true;
                    break;
                }
            }
            groupObject = {
                display_name: body.display_name
            };   
            if (found) {
                //Add all the private info because you're in the private group
                groupObject.name = body.name;
                groupObject.owner = body.owner;
                groupObject.members = body.members;
            }
            res.send(groupObject, 200);       
        } else {
            res.send("Didn't find group", 200);
        }
    });
});

app.post('/advancetransaction', auth.checkAuth, function(req, res) {
    var username = req.user.username;
    var transaction = req.body.transaction;

    if (username.length == 0 || transaction.length == 0) {
         //TODO better login submission checking
        res.send('Bad transactioninfo submission', 400);
        return;
    }
    
    transactiondb.get(transaction, function (err, body) {
        if (!err) {
            if (!(username === body.username1 || username === body.username2)) {
                //User shouldn't see it even though it was found
                res.send('Unable to find transaction', 200);                
                return;
            }
            //verify that the user can actually update the transaction
            // flow is represented by an fsm but the path should be always
            // increasing and will skip either 3 or 4 to get to 5
            // Remember the following rules:
            // 1 = waiting on user 2
            // 2 = waiting on either user
            // 3 = waiting on user 1
            // 4 = waiting on user 2
            // 5 = done
            var numToUpdateTo = -1;
            switch (body.status) {
                case 1:
                    if (username === body.username2) {
                        numToUpdateTo = 2;
                    }
                    break;
                case 2:
                    if (username === body.username1) {
                        numToUpdateTo = 4;
                    } else if (username === body.username2) {
                        numToUpdateTo = 3;
                    }
                    break;
                case 3:
                    if (username === body.username1) {
                        numToUpdateTo = 5;
                    }
                    break;
                case 4:
                    if (username === body.username2) {
                        numToUpdateTo = 5;
                    }
                default:
                    break;
            }
            if (numToUpdateTo == 5) {
                //TODO increment reputation and stuff
            }
            if (numToUpdateTo == -1) {
                //User not able to update transaction
                res.send('Not able to update', 200);
            }
            body.status = numToUpdateTo;
            body.lastModifiedTime = new Date();
            transactiondb.insert(body, body.id, function (err, body) {
                if (!err) {
                    console.log("Updated transaction="+transaction);
                    res.send('Updated successfully', 200);
                } else {
                    res.send('Unable to update transaction', 200);
                }
            });
        } else {
            res.send('Unable to find transaction', 200);
        }   
    });
});

app.listen(3000);
console.log('Server started');
