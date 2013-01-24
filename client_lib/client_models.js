define('client_models', ['backbone', 'underscore'], function(Backbone, _) {
    // Client side user model
    var User = Backbone.Model.extend({
        idAttribute: 'username',
        urlRoot: '/user',
        groups: function(callback) {
            if (this._groups) {
                callback(this._groups);
            } else {
                complete_callback = _.after(this.get('groups').length, callback);
                this._groups = new GroupsForUser();
                _.each(this.get('groups'), function(name) {
                    var group = new Group({name: name});
                    group.fetch().done(_.bind(function() {
                        complete_callback(this._groups);
                    }, this));
                    this._groups.add(group);
                }, this);
            }
        }
    });
    var Group = Backbone.Model.extend({
        idAttribute: 'name',
        urlRoot: '/group'
    });
    var GroupsForUser = Backbone.Collection.extend({
        model: Group
    });
    return { User :  User,
             Group: Group,
             GroupsForUser: GroupsForUser
           };
});
