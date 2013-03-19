// Main.js - routes for things that are site wide, like login logout.
// Resist the urge to put anything in here if it isn't applicable to everything

var db = require('../db');
var check = require('../validate').check;

exports.install_routes = function(app) {
    var auth = require('./auth')(app.User);

    app.post('/login', function(req, res) {
        var email = req.body.email.toLowerCase();
        var pass = req.body.password;

        try {
            check(email, "email");
            check(pass, "password");
        } catch (e) {
            res.send({error: e.message, success: false});
            return;
        }
        
        var response = {logged_in: false};
        app.User.load_by_index('email', email).then(function(user) {
            auth.hash_password(pass, user.get('salt'), function(hashed_pass) {
                if (user.get('password') == hashed_pass) {
                    req.session.user_id = user.get('id');
                    response.logged_in = true;
                    response.id = user.get('id');
                } else {
                    response.error = 'Invalid username or password';
                }
                //if (remember me checked)
                // Set the expiration time on cookie
                response.success = true;
                res.send(response);
            });
        }).fail(function(err) {
            //Couldn't find it in database OR database is unavailable
            response.error = 'Invalid email or password';
            response.success = false;
            res.send(response);
        });
    });

    app.post('/logout', auth.checkAuth, function(req, res) {
        delete req.session.user_id;
        res.send({success: true});
    });
};
