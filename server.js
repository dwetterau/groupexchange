var express = require('express');
var connect = require('connect');
var check = require('./validate').check;//require('validator').check;
//var sanitize = require('validator').sanitize;

var auth = require('./auth');
var db = require('./db');

var userdb = db.users;
var transactiondb = db.transactions;
var groupdb = db.groups;
var groupmembersdb = db.groupmembers;
var personaldb = db.personal;
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

//Takes a couchDB doc and removes the private couchdb info from it
// The doc itself has private couchDB stuff that Idk if we want to expose...
function cleanDoc(doc) {
    doc._rev = undefined;
    doc._id = undefined;
}

app.get('/user/:username', auth.checkAuth, function(req, res) {
    var username = req.params.username;
    if (req.user.username !== username) {
        res.send({error: 'Other profile viewing not implemented yet', success: false});
    }
    userdb.get(username, function(err, doc) {
        if (err) {
            res.send({error: err, success: false});
        } else {
            cleanDoc(doc);
            doc.password = undefined;
            doc.salt = undefined;
            res.send({user: doc, success: true});
        }
    });
});

app.get('/group/:name', auth.checkAuth, function(req, res) {
    var name = req.params.name;
    var username = req.user.username;
    groupmembersdb.view('members', 'members', {keys: [name]}, function(err, body) {
        if (err) {
            res.send({error: err, success: false});
            return;
        }
        var group_members = body.rows.map(function(row) { return row.value; });
        if (group_members.indexOf(username) == -1) {
            res.send({error: 'User not in group', success: false});
            return;
        }
        groupdb.get(name, function(err, doc) {
            if (err) {
                res.send({error: err, success: false});
            } else {
                cleanDoc(doc);
                res.send({group: doc, success: true});
            }
        });
    });
});

app.post('/makeaccount', function(req, res) {
    var username = req.body.username.toLowerCase();
    var email = req.body.email.toLowerCase();
    //var first = req.body.firstname;
    //var last = req.body.lastname;
    var pass = req.body.password;

    try {
        check(username, 'username');
        check(email, 'email');
        //check(first).len(1,64).isAlpha();
        //check(last).len(1,64).isAlpha(); //TODO allow hyphens in last name? / more regex
    } catch (e) {
        res.send({error: e.message, success: false});
        return;
    }
    
    userdb.head(username, function(err, body) {
        if (!err) {
            res.send({error: 'Username is already in use', success: false});
        } else {
            var salt = auth.generateSalt(128);
            auth.hash_password(pass, salt, function(hashed_pass) {
                //create the account
                var newUser = {
                    username: username,
                    email: email,
                    //firstname: first,
                    //lastname: last,
                    password: hashed_pass,
                    salt: salt,
                    reputation: 0
                };
                userdb.insert(newUser, username, function(err, body) {
                    if (!err) {
                        console.log('Made new user='+username);
                        res.send({success: true});
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

    var allNull = true
    if (firstname) {
        allNull = false
        try {
            check(firstname, "name");
        } catch (e) {
            res.send({error: e, success: false});
            return;
        }
    }
    if (lastname) {
        allNull = false
        try {
            check(lastname, "name");
        } catch (e) {
            res.send({error: e, success: false});
            return;
        }
    }
    if (allNull) {
        res.send({error: "Nothing to update", success: false});
        return;
    }
    personaldb.get(username, function(err, body) {
        if (err) {
            object = {
                username: username,
                firstname: firstname,
                lastname: lastname
            };
            personaldb.insert(object, username, function(err, body) {
                if (err) {
                    res.send({error: err, success: false});
                } else {
                    res.send({success: true});
                }
            });
        } else {
            if (!body.firstname) {
                body.firstname = firstname;
            }
            if (!body.lastname) {
                body.lastname = lastname;
            }
            personaldb.insert(body, username, function(err, body) {
                if (err) {
                    res.send({error: err, success: false});
                } else {
                    res.send({success: true});
                }
            });
        }
    });

});

// Creates a group
app.post('/makegroup', auth.checkAuth, function(req, res) {
    var username = req.user.username;
    var groupname = req.body.groupname.toLowerCase();

    try {
        check(groupname, "groupname");
    } catch (e) {
        res.send({error: e.message, success: false});
        return;
    }

    var group_name_combined = username + '-' + groupname; 
    groupdb.head(group_name_combined, function(err, body) {
        if (!err) {
            res.send({error: 'Groupname is in use', success: false}); //Aka this user has already created a group with this name
        } else {
            var groupObject = {
                name: group_name_combined,
                display_name: groupname,
                owner: username
            };
            groupdb.insert(groupObject, group_name_combined, function(err, body) {
                if (!err) {
                    console.log('Made new group='+group_name_combined);
                    addUserToGroup(username, group_name_combined, res); 
                } else {
                    res.send({error: 'Unable to make group at this time', success: false});
                }
            });
        }
    });
});

// Adds a user to a group
app.post('/addgroup', auth.checkAuth, function (req, res) {
    var username = req.user.username;
    var groupname = req.body.groupname.toLowerCase();
    var user_to_add = req.body.useradd.toLowerCase();
    
    try {
        check(groupname, "groupname");
        check(user_to_add, "username");
    } catch (e) {
        res.send({error: e.message, success: false});
        return;
    }
   
    groupmembersdb.view('members', 'members', {keys: [groupname]}, function(err, body) {
        if (err) {
            res.send({error: err, success: false});
            return;
        }
        var group_members = body.rows.map(function(row) { return row.value; });
        if (group_members.indexOf(username) == -1) {
            res.send({error: 'User not in group', success: false});
            return;
        }
        if (group_members.indexOf(user_to_add) != -1) {
            res.send({error: 'User already in group', success: false});
            return;
        }
        //Check to see if the user actually exists
        userdb.head(user_to_add, function(err, body) {
            if (!err) {
                addUserToGroup(user_to_add, groupname, res);
            } else {
                res.send({error: 'Could not find user', success: false});
            }
        });
    });
});

function addUserToGroup(username, groupname, res) {
    link_object = {
      user: username,
      group: groupname
    };
    groupmembersdb.insert(link_object, username+groupname, function(err, body) {
        if (err) {
            res.send({error: err, success: false});
            console.log("Failed to add user '" + username + "' to group '" +
                        groupname + "'");
        } else {
            res.send({success: true});
            console.log("Added user '" + username + "' to group '" + groupname + "'");
        }
    });
}

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

app.post('/addtransaction', auth.checkAuth, function(req, res) {
    //The request will store the usernames of both of the parties in the transaction
    var username1 = req.user.username;
    var username2 = req.body.username2.toLowerCase();
    var direction = req.body.direction == "true"; //normal direction is from username1 to username2
    var amount = req.body.amount;
    var createTime = new Date();
    var details = req.body.details;
    var group  = req.body.group;
    
    try {
        check(username2, "username");
        check(amount, "value");
        if (details) {
            check(details).len(1,250);
        }
        if (group) {
            check(group).len(8,49);
        }
    } catch (e) {
        res.send({error: e.message, success: false});
        return;
    }
   
    var sender = username1, receiver = username2;
    if (!direction) {
        sender = username2;
        receiver = username1;
    }

    var transactionObject = {
        sender: sender,
        receiver: receiver,
        creator: username1,
        amount: amount,
        direction: direction,
        status: 1, // creator has approved it
        createTime : createTime,
        lastModifiedTime : createTime
    };

    if (details) {
        transactionObject.details = details;
    } 
    if (group) {
        transactionObject.group = group;
    }
    
    // The structure is reversed so that the callbacks work in order to serialize
    // the data retrievals.
    var makeTransaction = function(num_transactions) {
        // This still uses username for the rare case that both users make the
        // transaction at the same time and it gets keyed as the same thing.
        // With creator first ordering this can't happen.
        transaction_name = username1 + '-' + username2 + '-' + num_transactions;
    
        console.log("Made new transasction="+transaction_name);
        transactionObject.id = transaction_name;
        
        transactiondb.insert(transactionObject, transaction_name, function(err, body) {
            if (err) {
                res.send({error: "Failed to add transaction", success: false});
            } else {
                res.send({success: true});
            }
        });
    };

    userdb.head(username2, function (err, body) {
            if (!err) {
                numTransactions(makeTransaction);
            } else {
                res.send({error: "Retrieval failed", success: false});
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

app.post('/transactioninfo', auth.checkAuth, function(req, res) {
    var username = req.user.username;
    var transaction = req.body.transaction;

    try {
        check(transaction, "transaction");
    } catch (e) {
        res.send({error: e.message, success: false});
        return;
    }

    transactiondb.get(transaction, function (err, doc) {
        if (!err) {
            if (!(username === doc.sender || username === doc.receiver)) {
                //User shouldn't see it even though it was found
                res.send({error: 'Unable to find transaction', success: false});                
                return;
            }
            console.log("Retrieved transaction data for transaction="+transaction);
            cleanDoc(doc);
            res.send({transaction: doc, success: true});
        } else {
            res.send({error: 'Unable to find transaction', success: false});
        }   
    });
});

app.post('/advancetransaction', auth.checkAuth, function(req, res) {
    var username = req.user.username;
    var transaction = req.body.transaction;

    try {
        check(transaction, "transaction");
    } catch (e) {
        res.send({error: e.message, success: false});
        return;
    }
    
    transactiondb.get(transaction, function (err, body) {
        if (!err) {
            if (!(username === body.sender || username === body.receiver)) {
                //User shouldn't see it even though it was found
                res.send({error: 'Unable to find transaction', success: false});                
                return;
            }
            //Verify that the user can actually update the transaction
            // flow is represented by an fsm but the path should be always
            // increasing and will skip either 3 or 4 to get to 5
            // Remember the following rules:
            // 1 = if direction then waiting on receiver else waiting on sender
            // 2 = waiting on either user
            // 3 = waiting on receiver
            // 4 = waiting on sender
            // 5 = done
            var numToUpdateTo = -1;
            switch (body.status) {
                case 1:
                    if (body.direction && username === body.receiver ||
                        !body.direction && username === body.sender) {
                        numToUpdateTo = 2;
                    }
                    break;
                case 2:
                    if (username === body.sender) {
                        numToUpdateTo = 3;
                    } else if (username === body.receiver) {
                        numToUpdateTo = 4;
                    }
                    break;
                case 3:
                    if (username === body.receiver) {
                        numToUpdateTo = 5;
                    }
                    break;
                case 4:
                    if (username === body.sender) {
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
                res.send({error: 'Not able to update', success: false});
                return;
            }
            body.status = numToUpdateTo;
            body.lastModifiedTime = new Date();
            transactiondb.insert(body, body.id, function (err, body) {
                if (!err) {
                    console.log("Updated transaction="+transaction);
                    res.send({success: true});
                } else {
                    res.send({error: 'Unable to update transaction', success: false});
                }
            });
        } else {
            res.send({error: 'Unable to find transaction', success: false});
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

app.get('/group/:name/members', auth.checkAuth, function(req, res) {
    var name = req.params.name;
    var username = req.user.username;
    groupmembersdb.view('members', 'members', {keys: [name]}, function(err, body) {
        if (err) {
            res.send({error: err, success: false});
            return;
        }
        var group_members = body.rows.map(function(row) { return row.value; });
        if (group_members.indexOf(username) == -1) {
            res.send({error: 'User not in group', success: false});
            return;
        } else {
            res.send({members: group_members, success: true});
        }
    });
});

app.get('/user/:username/groups', auth.checkAuth, function(req, res) {
    var name = req.params.username;
    var username = req.user.username;
    if (username != name) {
        res.send({error: "You cannot view another user's groups yet", success: false});
        return;
    }
    groupmembersdb.view('groups', 'groups', {keys: [name]}, function(err, body) {
        if (err) {
            res.send({error: err, success: false});
            return;
        }
        var groups = body.rows.map(function(row) { return row.value; });
        res.send({groups: groups, success: true});
    });
});


app.get('/user/:username/alltransactions', auth.checkAuth, function(req, res) {
    var username = req.params.username;
    if (req.user.username !== username) {
        res.send({error: "You can't see other members's transactions", success: false});
    }
    transactiondb.view('alltransactions', 'alltransactions', {keys: [username]}, 
      function(err, body) {
        if (!err) {
            var transactions = body.rows.map(function(row) {   
                var trans = row.value;
                cleanDoc(trans);
                return trans;
            });
            res.send({transactions: transactions, success: true});
        } else {
            res.send({error: err, success: false});
        }
    });
});

app.get('/user/:username/usertransactions', auth.checkAuth, function(req, res) {
    var username_other = req.params.username;
    var username = req.user.username;
    transactiondb.view('usertransactions', 'usertransactions', {keys: [[username, username_other]]}, 
      function(err, body) {
        if (!err) {
            var transactions = body.rows.map(function(row) {   
                var trans = row.value;
                cleanDoc(trans);
                return trans;
            });
            res.send({transactions: transactions, success: true});
        } else {
            res.send({error: err, success: false});
        }
    });
});

app.get('/user/:groupname/grouptransactions', auth.checkAuth, function(req, res) {
    var groupname = req.params.groupname;
    transactiondb.view('grouptransactions', 'grouptransactions', 
        {keys: [[req.user.username, groupname]]}, function(err, body) {
        if (!err) {
            var transactions = body.rows.map(function(row) {   
                var trans = row.value;
                cleanDoc(trans);
                return trans;
            });
            res.send({transactions: transactions, success: true});
        } else {
            res.send({error: err, success: false});
        }
    });
});


app.listen(3000);
console.log('Server started');
