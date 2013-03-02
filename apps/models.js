// Models.js - contains code to help get, manipulate, and save data

var db = require('../db');
var _ = require('underscore')._;
var utils = require('../utils');

exports.install_models = function(bucket, app) {
    var ModelBase = {
        // Function that saves the object in the database
        save: function(callback, err_cb) {
            bucket.set(this.get_db_id(), this.toJSON(), function(err, meta) {
                if (err) {
                    err_cb(err);
                } else {
                    callback(meta);
                }
            });
        },
        // Function that loads the object from the database based on its id.
        load: function(callback, err_cb) {
            bucket.get(this.get_db_id(), _.bind(function(err, doc, meta) {
                if (err) {
                    err_cb(err);
                } else {
                    this.update(doc);
                    callback(doc);
                }
            }, this));
        },
        // Function that checks to see if the object exists in the db or not based 
        // off id. This will prevent a full load if that isn't needed.
        exists: function(callback, err_cb) {
            bucket.get(this.get_db_id(), _.bind(function(err, doc, meta) {
                if (err) {
                    err_cb(err);
                } else {
                    callback();
                }
            }, this));

        },
        // Function that performs a view
        view: function(keys, name, db, callback, err_cb) {
            bucket.view('default', name, {keys: keys}, _.bind(function(err, view) {
                if (err) {
                    err_cb(err);
                } else {
                    callback(view);
                }
            }, this));
        },
        // Type of model, overridden by subclasses
        type: "Base",
        // Function that can be overridden to use any attribute as an id
        get_id: function() {
            if (this.attributes && this.attributes.id) {
                return this.attributes.id;
            }
        },
        // Function to return the key used by the database
        get_db_id: function() {
            return this.type + '::' + this.get_id();
        },
        // Does not actually return JSON string; this is how the JSON api
        // is supposed to work...
        // https://developer.mozilla.org/en-US/docs/JSON#toJSON%28%29_method
        toJSON: function() {
            if (this.attributes) {
                // TODO: This isn't a deep clone, and should be
                return _.clone(this.attributes);
            }
        },
        // returns a value from attributes, use this function rather than attributes
        // directly so that we can programmatically detect when attributes
        // are accessed or modified
        get: function(keyname) {
            if (this.attributes) {
                return this.attributes[keyname];
            }
        },
        // sets a value in the attributes
        set: function(keyname, value) {
            if (this.attributes) {
                this.attributes[keyname] = value;
            }
        },
        // Update a set of values on the object
        update: function(values) {
            var key;
            for (key in values) {
                if (values.hasOwnProperty(key)) {
                    if (this.attributes[key] != values[key]) {
                        this.set(key, values[key]);
                    }
                }
            }
        }
    };

    var User = function(id) {
        this.attributes = {};
        // TODO: I think this is going to change soon
        this.set('email', id);
        this.get_id = function() {
            return this.get('email');
        };
    };
    User.prototype = _.clone(ModelBase);
    User.prototype.type = 'user';


    var Personal = function(id) {
        this.attributes = {};
        this.set('username', id);
        // Set permissions to default
        this.setBasicPermissions = function() {
            this.set('permissions', {
                global: {
                    firstname: true,
                    lastname: false,
                    email: false,
                    username: true,
                    reputation: true
                },
                partners: {
                    firstname: true,
                    lastname: true,
                    email: true,
                    username: true,
                    reputation: true
                }
            });
        };
        this.get_id = function() {
            return this.get('username');
        };
        this.get_groups = function(callback, err_cb) {
            this.view([this.get_id()], 'groups', db.groupmembers, callback, err_cb);
        };
    };
    Personal.prototype = _.clone(ModelBase);
    Personal.prototype.type = 'personal';

    var Transaction = function(id) {
        this.attributes = {};
        this.set('id', id);
        this.getAllTransactions = function(username, callback, err_cb) {
            this.view([username], 'alltransactions', db.transactions, callback, err_cb);
        };
        this.getUserTransactions = function(username1, username2, callback, err_cb) {
            this.view([[username1, username2]], 'usertransactions', db.transactions,
                      callback, err_cb);
        };
        this.getGroupTransactions = function(username, groupname, callback, err_cb) {
            this.view([[username, groupname]], 'grouptransactions', db.transactions,
                      callback, err_cb);
        };
        this.advance = function(username, callback, err_cb) {
            username = username.toString();
            //Verify that the user can actually update the transaction
            // flow is represented by an fsm but the path should be always
            // increasing and will skip either 3 or 4 to get to 5
            // Remember the following rules:
            // 1 = if direction then waiting on receiver else waiting on sender
            // 2 = waiting on either user
            // 3 = waiting on receiver
            // 4 = waiting on sender
            // 5 = done
            var numToUpdateTo = -1;
            switch (this.get('status')) {
            case 1:
                if (this.get('direction') && username == this.get('receiver') ||
                    !this.get('direction') && username == this.get('sender')) {
                    numToUpdateTo = 2;
                }
                break;
            case 2:
                if (username === this.get('sender')) {
                    numToUpdateTo = 3;
                } else if (username === this.get('receiver')) {
                    numToUpdateTo = 4;
                }
                break;
            case 3:
                if (username === this.get('receiver')) {
                    numToUpdateTo = 5;
                }
                break;
            case 4:
                if (username === this.get('sender')) {
                    numToUpdateTo = 5;
                }
                break;
            default:
                break;
            }
            if (numToUpdateTo == 5) {
                //TODO increment reputation and stuff
            }
            if (numToUpdateTo == -1) {
                //User not able to update transaction
                err_cb('Not able to update');
                return;
            }
            this.set('status', numToUpdateTo);
            this.set('lastModifiedTime', new Date());
            callback();
        };
    };
    Transaction.prototype = _.clone(ModelBase);
    Transaction.prototype.type = 'transaction';

    var GroupMember = function(id) {
        this.attributes = {};
        this.set('id', id);
    };
    GroupMember.prototype = _.clone(ModelBase);
    GroupMember.prototype.type = 'groupmember';

    var Group = function(id) {
        this.attributes = {};
        this.set('name', id);
        this.get_id = function() {
            return this.get('name');
        };
        this.get_members = function(callback, err_cb) {
            this.view([this.get_id()], 'members', db.groupmembers, callback, err_cb);
        };
    };
    Group.prototype = _.clone(ModelBase);
    Group.prototype.type = 'group';

    app.User = User;
    app.Personal = Personal;
    app.Transaction = Transaction;
    app.GroupMember = GroupMember;
    app.Group = Group;
};

