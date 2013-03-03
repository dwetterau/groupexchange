var crypto = require('crypto');
var db = require('../db');

function is_logged_in(req) {
    if (req.session.user_id) {
        return true;
    } else {
        return false;
    }
}

function checkAuth(req, res, next) {
     if (!is_logged_in(req)) {
         res.send(JSON.stringify({error: 'Not logged in', success: false}));
     } else {
         console.log(req.session.user_id);
         db.users.get(req.session.user_id, function(err, doc) {
             req.user = doc;
             next();
         });
     }
}

function generateSalt(len) {
    return new Buffer(crypto.randomBytes(len)).toString('base64');
}

function hash_password(password, salt, callback) {
    crypto.pbkdf2(password, salt, 10000, 512, function(err, dk) {
        if (err) {
            console.error('Error hashing a password');
            throw new Error(err);
        } else {
            callback(new Buffer(dk).toString('base64'));
        }
    });
    return;
}

exports.checkAuth = checkAuth;
exports.generateSalt = generateSalt;
exports.hash_password = hash_password;
