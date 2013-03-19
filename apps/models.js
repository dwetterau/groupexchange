// Models.js - contains code to help get, manipulate, and save data

var db = require('../db');
var couchbase = require('couchbase');
var _ = require('underscore')._;
var utils = require('../utils');
var jquery = require('jquery');

exports.install_models = function(bucket, app) {

    // This class represents a unique index on a model class
    var UniqueIndex = function(parent, name) {
        this.parent = parent;
        this.name = name;
    };

    // Private function to delete an index document from the db
    UniqueIndex.prototype._delete_from_db = function(value) {
        var deferred = jquery.Deferred();
        var dbid = this.get_key_prefix() + value;
        bucket.remove(dbid, function(err, meta) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
            }
        });
    };
    
    // Create a new index document
    UniqueIndex.prototype.get_key_prefix =  function() {
        return this.parent.type + '::' + this.name + '::';
    };
    UniqueIndex.prototype.create = function(id, value) {
        var dbid = this.get_key_prefix() + value;
        var deferred = jquery.Deferred();
        bucket.add(dbid, id, function(err, meta) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
            }
        });
        return deferred;
    };
    UniqueIndex.prototype.update = function(id, value) {
        var dbid = this.get_key_prefix() + value;
        var deferred = jquery.Deferred();
        bucket.set(dbid, id, function(err, meta) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
            }
        });
        return deferred;
    };
    
    // Constructs a model with type type, id attribute id, and a list
    // of unique attributes, generate_unique = true => keep a counter
    // and increment it for every object created
    var Model = function(type, id, uniques, generate_unique, instance_attrs, 
      static_funcs) {
        this.type = type;
        this.id_attr = id;
        this.generate_unique = generate_unique;
        this.ModelInstance = ModelInstanceConstructor(instance_attrs);
        this.static = static_funcs;
        if (uniques) {
            this.indicies = uniques.map(_.bind(function(unique) {
                return new UniqueIndex(this, unique);
            }, this));
        } else {
            this.indicies = [];
        }
    };

    // Private function that adds the object to the db
    Model.prototype._add_to_db = function(dbid, attributes) {
        var deferred = jquery.Deferred();
        bucket.add(dbid, attributes, function(err, meta) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(meta);
            }
        });
        return deferred;
    };

    // Private function that removes the object from the db
    Model.prototype._delete_from_db = function(dbid) {
        var deferred = jquery.Deferred();
        bucket.remove(dbid, function(err, meta) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(meta);
            }
        });
        return deferred;
    };

    // Private function that updates an object in the db
    Model.prototype._update_in_db = function(dbid, attributes) {
        var deferred = jquery.Deferred();
        bucket.set(dbid, attributes, function(err, meta) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(meta);
            }
        });
        return deferred;
    };
    
    // Function that creates the object in the database
    Model.prototype.create = function(attributes) {
        attributes.type = this.type;
        var deferred = jquery.Deferred();
        var counter_deferred = jquery.Deferred();
        // If we want a unique id, increment a counter. Otherwise, pass in the given id
        if (this.generate_unique) {
            var counter_id = this.type + '::' + 'count';
            bucket.incr(counter_id, function(err, count) {
                if (err) {
                    counter_deferred.reject(err);
                } else {
                    counter_deferred.resolve(count);
                }
            });
        } else {
            counter_deferred.resolve(attributes[this.id_attr]);
        }
        counter_deferred.done(_.bind(function(id) {
            var dbid = this.type + '::' + id;
            attributes[this.id_attr] = id;
            // Rollback system - when an index is successfully
            // inserted, we add it to this list in case we need to
            // roll it back.
            var completed_indicies = [];
            var add_indexes = this.indicies.map(function(index) {
                var value = attributes[index.name];
                // After index is successfully inserted, push it onto compeleted indicies
                var index_create = index.create(dbid, value).then(function() {
                    completed_indicies.push(index);
                });
                return index_create;
            });
            // If base add completes, set this to true
            var add_completed = false;
            var add_def = this._add_to_db(dbid, attributes).then(_.bind(function() {
                if (rollback) {
                   this._delete_from_db(dbid);
                }
            }, this));
            add_indexes.push(add_def);
            // If anything fails, then set rollback to true
            var rollback = false;
            var all_done = jquery.when.apply(jquery, add_indexes);
            all_done.fail(function() {
                rollback = true;
            }).always(_.bind(function() {
                // After EVERYTHING is done, if we need to rollback then
                // do so, otherwise resolve the deferred
                if (rollback) {
                    var rollback_indicies = completed_indicies.map(function(index) {
                        var value = attributes[index.name];
                        return index._delete_from_db(value);
                    });
                   // OK, so I'm going to assume these deletes always succede
                    // If they don't then we can't do much about it
                    jquery.when.apply(jquery, rollback_indicies).always(function() {
                        deferred.reject("Uniqueness violated");
                    });
                } else {
                    var instance = this.create_instance(attributes);
                    deferred.resolve(instance);
                }
            }, this));
        }, this));
        return deferred;
    };
    
    // Function that updates an object in the database
    Model.prototype.update = function(attributes, updates) {
        var deferred = jquery.Deferred();
        var dbid = this.type + '::' + attributes.id;
        // Determine which indicies are changing
        var changing_indicies = this.indicies.filter(function(index) {
            return updates.hasOwnProperty(index.name);
        });
        // This is set to true as soon as a rollback is required
        var rollback = false;
        // After an index is successfully deleted, it is added to this
        var deleted_indicies = [];
        // After an index is successfully added, it is added to this
        var added_indicies = [];
        // After inserts are completely finished, we run deletes
        var delete_old = [];

        var insert_new = jquery.when.apply(jquery, changing_indicies.map(function(index) {
            var value = updates[index.name].new;
            return index.create(dbid, value).then(function() {
                added_indicies.push(index);
            });
        })).then(function() {
            delete_old = jquery.when.apply(jquery, changing_indicies.map(function(index) {
                var value = updates[index.name].old;
                return index._delete_from_db(value).then(function() {
                    deleted_indicies.push(index);
                });
            }));
        });

        // After the doc is updated, this is set to true
        var updated = false;
        var update_doc = this._update_in_db(dbid, attributes).then(function() {
            updated = true;
        });

        // After anything fails, set rollback to true
        jquery.when(update_doc, delete_old, insert_new).fail(function() {
            rollback = true;
        }).always(function() {
            // If rollback is true, roll everything back
            var all_rollback = [];
            if (rollback) {
                if (updated) {
                    // TODO: deep clone here
                    var old_attributes = _.clone(attributes);
                    for (var update in updates) {
                        if (updates.hasOwnProperty(update)) {
                            old_attributes[update] = updates[update].old;
                        }
                    }
                    all_rollback.push(this._update_in_db(dbid, old_attributes));
                }
                all_rollback += deleted_indicies.map(function(index) {
                    var value = updates[index.name].old;
                    return index.create(dbid, value);
                });

                all_rollback += added_indicies.map(function(index) {
                    var value = updates[index.name].new;
                    return index._delete_from_db(value);
                });

                // Assume always works
                jquery.when.apply(jquery, all_rollback).always(function() {
                    deferred.reject('Conflict with unique key');
                });
            } else {
                // Clear the updated object
                deferred.resolve();
            }
        });
        return deferred;
    };
    
    // Function that loads the object from the database based on an id 
    Model.prototype.load = function(id) {
        var deferred = jquery.Deferred();
        var dbid = this.type + '::' + id;
        bucket.get(dbid, _.bind(function(err, doc, meta) {
            if (err) {
                deferred.reject(err);
            } else {
                var instance = this.create_instance(doc);
                deferred.resolve(instance);
            }
        }, this));
        return deferred;
    };

    // Function that loads the object from the database based on an index and a value
    Model.prototype.load_by_index = function(index_name, value) {
        var deferred = jquery.Deferred();
        var dbid = this.type + '::' + index_name + '::' + value;
        var self = this;
        bucket.get(dbid, function(err, doc, meta) {
            if (err) {
                deferred.reject(err);
            } else {
                bucket.get(doc, function(err, doc, meta) {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        var instance = self.create_instance(doc);
                        deferred.resolve(instance);
                    }
                });
            }
        });
        return deferred;
    };

    // Function that performs a view
    Model.prototype.view = function(query_object, name, callback, err_cb) {
        // NEVER WANT STALE!!!!!!! RARRRRRR!!!!
        query_object.stale =  query_object.stale || false;
        bucket.view('default', name, query_object, _.bind(function(err, view) {
            if (err) {
                err_cb(err);
            } else {
                callback(view);
            }
        }, this));
    };

    Model.prototype.create_instance = function(attributes) {
        return new this.ModelInstance(this, attributes);
    };

    var ModelInstanceConstructor = function(instance_attrs) {
        var ModelInstance = function(model, attributes) {
            this.attributes = attributes;
            this.type = model.type;
            this.id_attr = model.id_attr;
            this.model = model;
            this.updated = {};
        };
        
        // Function that can be overridden to use any attribute as an id
        ModelInstance.prototype.get_id = function() {
            return this.get(this.id_attr);
        };
        // Function to return the key used by the database
        ModelInstance.prototype.get_db_id = function() {
            return this.type + '::' + this.get_id();
        };
        // Does not actually return JSON string; this is how the JSON api
        // is supposed to work...
        // https =//developer.mozilla.org/en-US/docs/JSON#toJSON%28%29_method
        ModelInstance.prototype.toJSON = function() {
            if (this.attributes) {
                // TODO: This isn't a deep clone, and should be
                return _.clone(this.attributes);
            }
        };
        // returns a value from attributes, use this function rather than attributes
        // directly so that we can programmatically detect when attributes
        // are accessed or modified
        ModelInstance.prototype.get = function(keyname) {
            if (this.attributes) {
                return this.attributes[keyname];
            }
        };
        // sets a value in the attributes
        ModelInstance.prototype.set = function(keyname, value) {
            if (this.attributes) {
                // Save the old state and new state in the updated
                if (this.updated.hasOwnProperty(keyname)) {
                    this.updated[keyname].new = value;
                } else {
                    this.updated[keyname] = {
                        old: this.attributes[keyname],
                        new: value
                    };
                }
                this.attributes[keyname] = value;
            }
        };
        // Update a set of values on the object
        ModelInstance.prototype.update = function(values) {
            var key;
            for (key in values) {
                if (values.hasOwnProperty(key)) {
                    if (this.attributes[key] != values[key]) {
                        this.set(key, values[key]);
                    }
                }
            }
        };

        // Call the update handler on the model, clear the updated hash if successful
        ModelInstance.prototype.save = function() {
            return this.model.update(this.toJSON(), this.updated).then(function() {
                this.updated = {};
            });
        };
        _.extend(ModelInstance.prototype, instance_attrs);
        return ModelInstance;
    };
    var User = new Model('user', 'id', ['email'], true);

    var Personal = new Model('personal', 'id', [], false, {
        setBasicPermissions : function() {
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
        },
        get_groups : function(callback, err_cb) {
            Model.prototype.view({key: this.get_id()}, 'user_groups', callback, err_cb);
        }
    });
        
    var Transaction = new Model('transaction', 'id', [], true, {
        advance: function(username, callback, err_cb) {
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
                if (username == this.get('sender')) {
                    numToUpdateTo = 3;
                } else if (username == this.get('receiver')) {
                    numToUpdateTo = 4;
                }
                break;
            case 3:
                if (username == this.get('receiver')) {
                    numToUpdateTo = 5;
                }
                break;
            case 4:
                if (username == this.get('sender')) {
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
        }
    }, {
        getAllTransactions: function(username, callback, err_cb) {
            Model.prototype.view({key: username}, 'all_transactions', callback, err_cb);
        },
        getUserTransactions: function(username1, username2, callback, err_cb) {
            Model.prototype.view({key: [username1, username2]}, 'user_transactions',
                      callback, err_cb);
        },
        getGroupTransactions: function(username, groupname, callback, err_cb) {
            Model.prototype.view({key: [username, groupname]}, 'group_transactions',
                      callback, err_cb);
        }
    });

    var GroupMember = new Model('groupmember', 'id', [], true);

    var Group = new Model('group', 'id', [], true, {
        get_members: function(callback, err_cb) {
            Model.prototype.view({key: this.get_id()}, 'group_members', callback, err_cb);
        }
    });

    app.User = User;
    app.Personal = Personal;
    app.Transaction = Transaction;
    app.GroupMember = GroupMember;
    app.Group = Group;
};

