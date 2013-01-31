var nano = require('nano')('http://localhost:5984');
var databases = ['users', 'transactions', 'groups', 'sessions'];
databases.forEach(function(database) {
    exports[database] = nano.use(database);
});
exports.nano = nano;
exports.databases = databases;
