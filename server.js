var nano = require('nano')('http://localhost:5984');
var express = require('express');

var userdb = nano.use('users');
var transactiondb = nano.use('transactions');

var app = express();

app.configure(function() {
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.static(__dirname + '/public'));
});

app.get('/all', function(req, res) {
    userdb.view('getAll','getAll',function (error, body, headers) {
        res.send(body, 200);
    });
});

app.post('/makeAccount', function(req, res) {
    var email = req.body.email.toLowerCase();
    var first = req.body.firstname;
    var last = req.body.lastname;
    var pass = req.body.password;

    if (email.length == 0 || first.length == 0 || last.length == 0 || pass.length == 0) {
        //TODO better account submission checking
        res.send('Bad form submission', 400);
        return;
    }
    
    var retrieved = userdb.head(email, function(err, body) {
        if (!err) {
            res.send('Email is already in use.', 200);
        } else {
            //create the account
            var newUser = {
                email: email,
                firstname: first,
                lastname: last,
                password: pass //TODO add encryption... BIG TODO TODO TODO WARNING
            };
            userdb.insert(newUser, email, function(err, body) {
                if (!err) {
                    res.send('Account created!', 200);
                } else {
                    res.send('Unable to make account at this time.', 200);
                }
            });
        }
    });
});

app.post('/login', function(req, res) {
    var email = req.body.email.toLowerCase();
    var pass = req.body.password;

    if (email.length == 0 || pass.length == 0) {
        //TODO better login submission checking
        res.send('Bad login submission', 400);
        return;
    }
    
    userdb.get(email, function (err, body) {
        if (!err) {
            //check the password
            if (body.password == pass) {
                //set their cookie with their username.. TODO make this un-spoofable
                //Good for 10 hours
                var cookieData = {
                    email: email,
                    firstname: body.firstname,
                    lastname: body.lastname,
                };
                console.log("User "+email+" logged in.");
                res.cookie('groupexchangename', JSON.stringify(cookieData), {maxAge: 604800000});
                // 604800000 ms = 7 days
                res.send('Now logged in!', 200);
            } else {
                res.send('Invalid password', 200);
            }
        } else {
            //Couldn't find it in database OR database is unavailable
            res.send('Invalid email', 200);
        }
    });
});

app.post('/addTransaction', function(req, res) {
    //The request will store the emails of both of the parties in the transaction
    var email1 = req.body.email1.toLowerCase;
    var email2 = req.body.email2.toLowerCase;
    var amount = req.body.amount;
    var transactionObject = {
        email1: email1,
        email2: email2,
        amount: amount,
        //still need to set the transaction id
        status: 1 // user1 who made the transaction has approved it
    };

    if (req.body.details) {
        transactionObject.details = req.body.details;
    } 

    //retrieve both users from the userdb
    var wait = true;
    var sent, user1, user2;
    console.log(3);
    userdb.get(email1, function (err, body) {
        console.log(4);
        if (!err) {
            user1 = body;
        } else {
            res.send("Retrieval failed.", 503);
            sent = true;
        }
        wait = false;
    });
    console.log(5);
    while (wait); //wait for the first user to be retrieved;
    console.log(6);
    if (sent) return;
    wait = true;
    userdb.get(email2, function (err, body) {
        if (!err) {
            user2 = body;
        } else {
            res.send("Retrieval failed.", 503);
            sent = true;
        }
        wait = false;
    });
    while (wait); //wait for the second one to complete.
    if (sent) return;
    transaction_name =  email1.substring(0, email1.indexOf('@')) + '-' +
                        email2.substring(0, email2.indexOf('@')) + '-' + 
                        numTransactions();
    console.log("Attempting to write transaction with name = '"+transaction_name+"'");
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
    wait = true;
    transactiondb.insert(transactionObject, transaction_name, function(err, body) {
        if (err) {
            res.send("Failed to add transaction.", 503);
            sent = true;
        }
        wait = false;
    });
    while (wait);
    if (sent) return;
    wait = true;
    userdb.insert(user1, email1, function(err, body) {
        if (err) {
            //shit... should we try to remove the transaction or just leave it?
            res.send("Failed to add transaction.", 503);
            sent = true;
        }
        wait = false;
    });
    while (wait);
    if (sent) return;
    userdb.insert(user2, email2, function(err, body) {
        if (err) {
            //shit... should we try to remove the transaction or just leave it?
            res.send("Failed to add transaction.", 503);
            sent = true;
        }  
        wait = false;
    });
    while (wait);
    if (sent) return;
    res.send("Successfully made new transaction.", 200);
});


function numTransactions() {
    var num = -1;
    var waiting = true;
    nano.db.get('transactions', function(err, body) {
        if (!err) {
            num = body.doc_count;;
        }
        waiting = false;
    });
    while (waiting);
    return num;
}


app.listen(3000);
console.log('Server started');
