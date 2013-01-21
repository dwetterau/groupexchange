var crypto = require('crypto');
var db = require('./db');

function checkAuth(req, res, next) {
    if (!req.session.user_id) {
        res.send('Not logged in');
    } else {
        next();
    }
}

function generateSalt(len) {
    return new Buffer(crypto.randomBytes(len)).toString('base64');
}

function hash_password(password, salt, callback) {
    crypto.pbkdf2(password, salt, 10000, 512, function(err, dk) {
        if (err) {
            console.error('Error hashing a password');
        } else {
            callback(new Buffer(dk).toString('base64'));
        }
    });
    return;
}

exports.checkAuth = checkAuth;
exports.generateSalt = generateSalt;
exports.hash_password = hash_password;
