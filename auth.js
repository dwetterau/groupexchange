var crypto = require('crypto');
var db = require('./db');

function checkAuth(req, res, next) {
    if (!req.session.user_id) {
        // Todo: lets decouple our urls
        res.redirect(301, '/login');
    } else {
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
