var express = require('express');
var connect = require('connect');
var check = require('validator').check;
var sanitize = require('validator').sanitize;

var auth = require('./auth');
var db = require('./db');

var userdb = db.users;
var transactiondb = db.transactions;
var groupdb = db.groups;
var groupmembersdb = db.groupmembers;
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
    var first = req.body.firstname;
    var last = req.body.lastname;
    var pass = req.body.password;

    try {
        check(username).len(4,256);
        check(email).len(6,256).isEmail();
        check(first).len(1,64).isAlpha();
        check(last).len(1,64).isAlpha(); //TODO allow hyphens in last name? / more regex
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
                    firstname: first,
                    lastname: last,
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

// Creates a group
app.post('/makegroup', auth.checkAuth, function(req, res) {
    var username = req.user.username;
    var groupname = req.body.groupname.toLowerCase();

    try {
        check(groupname).len(4,32);
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
                owner: username,
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
        check(groupname).len(8,49);
        check(user_to_add).len(4,16).isAlphanumeric();
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
        addUserToGroup(user_to_add, groupname, res);
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
            console.log("Failed to add user '" + username + "' to group '" 
                + groupname + "'");
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
        check(username).len(4,256);
        check(pass).notNull()
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
    res.redirect(301, '/');
});

app.post('/addtransaction', auth.checkAuth, function(req, res) {
    //The request will store the usernames of both of the parties in the transaction
    var username1 = req.user.username;
    var username2 = req.body.username2.toLowerCase();
    var amount = req.body.amount;
    var direction = req.body.direction === 'to_other'; //normal direction is from username1 to username2
    var createTime = new Date();
    var details = req.body.details;
    var group  = req.body.group;

    try {
        check(username2).len(4,16).isAlphanumeric();
        check(amount).isInteger();
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

    if (details) {
        transactionObject.details = details;
    } 
    if (group) {
        transactionObject.group = group;
    }
    
    // The structure is reversed so that the callbacks work in order to serialize
    // the data retrievals.
    var makeTransaction = function(num_transactions) {
        transaction_name =  username1 + '-' + username2 + '-' + num_transactions;
    
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

    var getSecond = function() {
        userdb.head(username2, function (err, body) {
            if (!err) {
                numTransactions(makeTransaction);
            } else {
                res.send({error: "Retrieval failed", success: false});
            }
        });
    };
    
    userdb.head(username1, function (err, body) {
        if (!err) {
            getSecond();
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
        check(transaction).notNull()
    } catch (e) {
        res.send({error: e.message, success: false});
        return;
    }

    transactiondb.get(transaction, function (err, doc) {
        if (!err) {
            if (!(username === doc.username1 || username === doc.username2)) {
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
        check(transaction).notNull()
    } catch (e) {
        res.send({error: e.message, success: false});
        return;
    }
    
    transactiondb.get(transaction, function (err, body) {
        if (!err) {
            if (!(username === body.username1 || username === body.username2)) {
                //User shouldn't see it even though it was found
                res.send({error: 'Unable to find transaction', success: false});                
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
                res.send({error: 'Not able to update', success: false});
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
/*    var form = formidable.IncomingForm();
    var files = [];
    var fields = [];

    form.keepExtensions = true;
    form.maxFieldsSize = 5*1024*1024;
    
    console.log("Form type: ", form.type);

    form
      .on('field', function(field, value) {
        console.log(field, value);
        fields.push([field, value]);
    })
      .on('fileBegin', function(name, file) {
        console.log("Uploading file name: ", name, " with size: ", form.bytesExpected);
        console.log("file is at: ", file.path);
    })
      .on('file', function(name, file) {
        console.log("Uploading file name: ", name, " with size: ", form.bytesExpected);
        console.log("file is at: ", file.path);
        files.push([field, file]);
    })
      .on('progress', function(bytesReceived, bytesExpected) {
        console.log("Received: ", bytesReceived, " bytes of: ", bytesExpected);
    });
  
    form.on('end', function() {
        res.send('Upload completed successfully');
    });
    
    form.parse(req, function(err, fields, files) {
        //Don't think I need anything here... except to later check the fields/file locations?  
        if ( error ) {
            console.log("ERROR: ", error);
            res.send("Upload error", 500);
        }
    });
*/
});


app.listen(3000);
console.log('Server started');
