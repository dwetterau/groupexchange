// Models.js - contains code to help get, manipulate, and save data

var db = require('../db');
var _ = require('underscore')._;

var ModelBase = {
    // Function that saves the object in the database
    save: function(callback, err_cb) {
        this.db.insert(this.toJSON(), this.get_id(), function(err, doc) {
            if (err) {
                err_cb(err);
            } else {
                callback(doc);
            }
        });
    },
    // Function that loads the object from the database based on its id.
    load: function(callback, err_cb) {
        this.db.get(this.get_id(), _.bind(function(err, doc) {
            if (err) {
                err_cb(err);
            } else {
                this.update(doc);
                callback(doc);
            }
        }, this));
    },
    // Function that can be overridden to use any attribute as an id
    get_id: function() {
        if (this.attributes && this.attributes.id) {
            return this.attributes.id;
        }
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
    this.db = db.users;
    // TODO: I think this is going to change soon
    this.set('email', id);
    this.get_id = function() {
        return this.get('email');
    };
};
User.prototype = _.clone(ModelBase);


var Personal = function(id) {
    this.attributes = {};
    this.db = db.personal;
    // TODO: I don't understand what "Username" refers to, so I'll just leave it as such
    this.set('username', id);
    // Set permissions to default
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
    this.get_id = function() {
        return this.get('username');
    };
};
Personal.prototype = _.clone(ModelBase);


exports.User = User;
exports.Personal = Personal;

