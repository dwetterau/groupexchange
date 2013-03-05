// Transactions.js - Functions related to managing transactions between users and groups
var check = require('../validate').check;
var utils = require('../utils');

exports.install_routes = function(app) {
    var auth = require('./auth')(app.User);
    app.post('/addtransaction', auth.checkAuth, function(req, res) {
        //The request will store the usernames of both of the parties in the transaction
        var username1 = req.user.get('id');
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
        var makeTransaction = function() {
            var new_transaction = app.Transaction.create(transactionObject)
                .then(function(transaction) {
                    res.send({success: true});
                }).fail(function(err) {
                    res.send({error: "Failed to add transaction", success: false});
            });
        };
        
        var other_user = app.Personal.load(username2).then(function() {
            makeTransaction();
        }).fail(function(err) {
            res.send({error: "Retrieval failed", success: false});
        });
    });

    app.post('/transactioninfo', auth.checkAuth, function(req, res) {
        var username = req.user.get('id');
        var transaction = req.body.transaction;

        try {
            check(transaction, "transaction");
        } catch (e) {
            res.send({error: e.message, success: false});
            return;
        }
        var transaction_model = app.Transaction.load(transaction)
          .then(function(doc) {
            if (!(username == doc.get('sender') 
              || username == doc.get('receiver'))) {
                //User shouldn't see it even though it was found
                res.send({error: 'Unable to find transaction', success: false});                
                return;
            }
            utils.cleanDoc(doc);
            res.send({transaction: doc, success: true});
        }).fail(function(err) { 
            res.send({error: 'Unable to find transaction', success: false});
        });
    });

    app.post('/advancetransaction', auth.checkAuth, function(req, res) {
        var username = req.user.get('id');
        var transaction = req.body.transaction;
        try {
            check(transaction, "transaction");
        } catch (e) {
            res.send({error: e.message, success: false});
            return;
        }
        var transaction_model = app.Transaction.load(transaction)
          .then(function (body) {
            if (!(username == body.get('sender') 
              || username == body.get('receiver'))) {
                //User shouldn't see it even though it was found
                res.send({error: 'Unable to find transaction', success: false});                
                return;
            }
            body.advance(username, function() {
                body.save().then(function(body) {
                    res.send({success: true});
                }).fail(function(err) {
                    res.send({error: 'Unable to update transaction', success: false});
                });
            }, function(err) {
                res.send({error: err, success: false});
            });
        }).fail(function(err) {
            res.send({error: 'Unable to find transaction', success: false});   
        });
    });

    //TODO MAKE THESE STATIC
    app.get('/user/:username/alltransactions', auth.checkAuth, function(req, res) {
        var username = req.params.username;
        if (req.user.get('id') !== username) {
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
        var username = req.user.get('id');
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
        trans.getGroupTransactions(req.user.get('id'), groupname, function(body) {
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

