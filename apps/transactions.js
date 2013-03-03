// Transactions.js - Functions related to managing transactions between users and groups
var check = require('../validate').check;
var utils = require('../utils');

exports.install_routes = function(app) {
    var auth = require('./auth')(app.User);
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
                check(details, "longtext");
            }
            if (group) {
                check(group, "groupname");
            }
        } catch (e) {
            res.send({error: e, success: false});
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
            var new_transaction = new app.Transaction(transaction_name); 
            new_transaction.update(transactionObject);
            new_transaction.save(function() {
                res.send({id: transaction_name, success: true});
            }, function(err) {
                res.send({error: "Failed to add transaction", success: false});
            });
        };
        
        var other_user = new app.Personal(username2);
        other_user.exists(function() {
            app.bucket.incr('trans_count::count', function(err, tid) {
                if (err) {
                    res.send({error: err, success: false});
                } else {
                    makeTransaction(tid);
                }
            }); 
        }, function(err) {
            res.send({error: "Retrieval failed", success: false});
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
        var transaction_model = new app.Transaction(transaction);
        transaction_model.load(function(doc) {
            if (!(username === doc.sender || username === doc.receiver)) {
                //User shouldn't see it even though it was found
                res.send({error: 'Unable to find transaction', success: false});                
                return;
            }
            utils.cleanDoc(doc);
            res.send({transaction: doc, success: true});
        }, function(err) { 
            res.send({error: 'Unable to find transaction', success: false});
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
        var transaction_model = new app.Transaction(transaction);
        transaction_model.load(function (body) {
            if (!(username === body.sender || username === body.receiver)) {
                //User shouldn't see it even though it was found
                res.send({error: 'Unable to find transaction', success: false});                
                return;
            }
            transaction_model.advance(username, function() {
                transaction_model.save(function(body) {
                    console.log("Updated transaction="+transaction);
                    res.send({success: true});
                }, function(err) {
                    res.send({error: 'Unable to update transaction', success: false});
                });
            }, function(err) {
                res.send({error: err, success: false});
            });
        }, function(err) {
            res.send({error: 'Unable to find transaction', success: false});   
        });
    });

    //TODO MAKE THESE STATIC
    app.get('/user/:username/alltransactions', auth.checkAuth, function(req, res) {
        var username = req.params.username;
        if (req.user.username !== username) {
            res.send({error: "You can't see other members' transactions", success: false});
        }
        var trans = new app.Transaction();
        trans.getAllTransactions(username, function(body) {
            var transactions = body.rows.map(function(row) {   
                var trans = row.value;
                utils.cleanDoc(trans);
                return trans;
            });
            res.send({transactions: transactions, success: true});
        }, function(err) {
            res.send({error: err, success: false});
        });
    });

    app.get('/user/:username/usertransactions', auth.checkAuth, function(req, res) {
        var username_other = req.params.username;
        var username = req.user.username;
        var trans = new app.Transaction();
        trans.getUserTransactions(username, username_other, function(body) {
            var transactions = body.rows.map(function(row) {   
                var trans = row.value;
                utils.cleanDoc(trans);
                return trans;
            });
            res.send({transactions: transactions, success: true});
        }, function(err) {        
            res.send({error: err, success: false});
        });
    });

    app.get('/group/:groupname/grouptransactions', auth.checkAuth, function(req, res) {
        var groupname = req.params.groupname;
        var trans = new app.Transaction();
        trans.getGroupTransactions(req.user.username, groupname, function(body) {
            var transactions = body.rows.map(function(row) {   
                var trans = row.value;
                utils.cleanDoc(trans);
                return trans;
            });
            res.send({transactions: transactions, success: true});
        }, function(err) {
            res.send({error: err, success: false});
        });
    });
};

