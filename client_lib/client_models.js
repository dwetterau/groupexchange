define('client_models', ['backbone', 'underscore'], function(Backbone, _) {
    // Client side user model
    var User = Backbone.Model.extend({
        idAttribute: 'username',
        urlRoot: '/user',
        name: function() {
            return this.get('firstname') + ' ' + this.get('lastname');
        },
        groups: function(callback) {
            var groups = new GroupsForUser();
            groups.url = 'user/' + this.get('username') + '/groups';
            groups.fetch({success: callback});
        },
        parse: function(data) {
            if (data.error || data.success === false) {
                return {failed: true};
            }
            return data.user;
        }
            
    });
    var Group = Backbone.Model.extend({
        idAttribute: 'name',
        urlRoot: '/group',
        members: function(callback) {
            var members = new MembersOfGroup();
            members.url = 'group/' + this.get('name') + '/members';
            members.fetch({
                success: function() {
                    members.fetch_all(callback);
                }
            });
        }

    });
    var GroupsForUser = Backbone.Collection.extend({
        model: Group,
        // TODO: Get this async forEach loop out into a separate util library
        parse: function(data) {
            return _.map(data.groups, function(item){
                return {name: item};
            });
        }
    });

    var MembersOfGroup = Backbone.Collection.extend({
        model: User,
        fetch_all: function(callback) {
            var success_cb = _.after(this.length, _.partial(callback, this));
            this.each(function(item) {
                item.fetch({success: success_cb});
            });
        },
        parse: function(data) {
            return _.map(data.members, function(member) {
                return {user: {username: member}};
            });
        }
    });
                                      
    return { User :  User,
             Group: Group,
             GroupsForUser: GroupsForUser
           };
});
