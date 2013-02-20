// Main.js - routes for things that are site wide, like login logout.
// Resist the urge to put anything in here if it isn't applicable to everything

var db = require('../db');
var check = require('../validate').check;
var auth = require('./auth');

exports.install_routes = function(app) {
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
        db.users.get(username, function (err, body) {
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
};
