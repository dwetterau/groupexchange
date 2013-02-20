// Transactions.js - Functions related to managing transactions between users and groups
var db = require('../db');
var check = require('../validate').check;
var auth = require('./auth');
var nano = db.nano;
var utils = require('../utils');

function numTransactions(callback) {
    nano.db.get('transactions', function(err, body) {
        if (!err) {
            callback(body.doc_count);
        } else {
            callback(-1);
        }
    });
}

exports.install_routes = function(app) {
    app.post('/addtransaction', auth.checkAuth, function(req, res) {
        //The request will store the usernames of both of the parties in the transaction
        var username1 = req.user.username;
        var username2 = req.body.username2.toLowerCase();
        var direction = req.body.direction == "true"; //normal direction is from username1 to username2
        var amount = req.body.amount;
        var createTime = new Date();
        var details = req.body.details;
        var group  = req.body.group;
        
        // TODO: This is broken
        /*try {
            check(username2, "username");
            check(amount, "value");
            if (details) {
                check(details).len(1,250);
            }
            if (group) {
                check(group).len(8,49);
            }
        } catch (e) {
            res.send({error: e, success: false});
            return;
        }*/
        
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
            
            db.transactions.insert(transactionObject, transaction_name, function(err, body) {
                if (err) {
                    res.send({error: "Failed to add transaction", success: false});
                } else {
                    res.send({success: true});
                }
            });
        };

        db.users.head(username2, function (err, body) {
            if (!err) {
                numTransactions(makeTransaction);
            } else {
                res.send({error: "Retrieval failed", success: false});
            }
        });
    });



    app.post('/transactioninfo', auth.checkAuth, function(req, res) {
        var username = req.user.username;
        var transaction = req.body.transaction;

        try {
            check(transaction, "transaction");
        } catch (e) {
            res.send({error: e.message, success: false});
            return;
        }

        db.transactions.get(transaction, function (err, doc) {
            if (!err) {
                if (!(username === doc.sender || username === doc.receiver)) {
                    //User shouldn't see it even though it was found
                    res.send({error: 'Unable to find transaction', success: false});                
                    return;
                }
                console.log("Retrieved transaction data for transaction="+transaction);
                utils.cleanDoc(doc);
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
        
        db.transactions.get(transaction, function (err, body) {
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
                    break;
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
                db.transactions.insert(body, body.id, function (err, body) {
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




    app.get('/user/:username/alltransactions', auth.checkAuth, function(req, res) {
        var username = req.params.username;
        if (req.user.username !== username) {
            res.send({error: "You can't see other members's transactions", success: false});
        }
        db.transactions.view('alltransactions', 'alltransactions', {keys: [username]}, 
                           function(err, body) {
                               if (!err) {
                                   var transactions = body.rows.map(function(row) {   
                                       var trans = row.value;
                                       utils.cleanDoc(trans);
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
        db.transactions.view('usertransactions', 'usertransactions', {keys: [[username, username_other]]}, 
                           function(err, body) {
                               if (!err) {
                                   var transactions = body.rows.map(function(row) {   
                                       var trans = row.value;
                                       utils.cleanDoc(trans);
                                       return trans;
                                   });
                                   res.send({transactions: transactions, success: true});
                               } else {
                                   res.send({error: err, success: false});
                               }
                           });
    });

    app.get('/group/:groupname/grouptransactions', auth.checkAuth, function(req, res) {
        var groupname = req.params.groupname;
        db.transactions.view('grouptransactions', 'grouptransactions', 
                           {keys: [[req.user.username, groupname]]}, function(err, body) {
                               if (!err) {
                                   var transactions = body.rows.map(function(row) {   
                                       var trans = row.value;
                                       utils.cleanDoc(trans);
                                       return trans;
                                   });
                                   res.send({transactions: transactions, success: true});
                               } else {
                                   res.send({error: err, success: false});
                               }
                           });
    });
};

