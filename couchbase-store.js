var couchbase = require('couchbase');

module.exports = function(connect, bucket) {
    var Store = connect.session.Store;
    var type = "session";

    function CouchbaseStore (options) {
        //https://github.com/visionmedia/connect-redis/blob/master/lib/connect-redis.js
        Store.call(this, options);
    }
    CouchbaseStore.prototype.__proto__ = Store.prototype;
    
    CouchbaseStore.prototype.get = function(sid, callback) {
        var dbid = type + '::' + sid;
        bucket.get(dbid, function(err, doc, meta) {
            if (err && err.code == couchbase.errors.keyNotFound) {
                callback();
            } else if (err) {
                callback(err);
            } else {
                callback(null, doc);
            }
        });
    };
    CouchbaseStore.prototype.set = function(sid, session, callback) {
        var dbid = type + '::' + sid;
        bucket.set(dbid, session, function(err, meta) {
            if (err) {
                callback(err);
            } else {
                callback();
            }
        });
    };
    CouchbaseStore.prototype.destroy = function(sid, callback) {
        var dbid = type + sid;
        bucket.delete(dbid, function(err, meta) {
            callback(err);
        });
    };
    return CouchbaseStore;
};
