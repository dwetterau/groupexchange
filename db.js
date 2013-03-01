var settings = require('./settings').settings;
var couchbase = require('couchbase');
exports.ready = function(callback) {
    var open_bucket = false;
    if (open_bucket) {
        callback(open_bucket);
    } else {
        couchbase.connect(settings.couchbase_config, function(err, bucket) {
            if (err) {
                // Could not connect to the DB? Big issue.
                throw err;
            }
            open_bucket = bucket;
            callback(bucket);
            open_bucket = false;
        });
    }
};


