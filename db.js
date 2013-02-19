var settings = require('./settings').settings;
var nano = require('nano')('http://' + settings.couchdb_hostname + ':' + settings.couchdb_port);
var databases = ['users', 
                 'transactions', 
                 'groups', 
                 'sessions', 
                 'groupmembers', 
                 'personal',
                 'privacy'];
databases.forEach(function(database) {
    exports[database] = nano.use(database);
});
exports.nano = nano;
exports.databases = databases;
