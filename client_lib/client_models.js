define('client_models', ['backbone', 'underscore'], function(Backbone, _) {
    // Client side user model
    var User = Backbone.Model.extend({
        idAttribute: 'username',
        urlRoot: '/user',
        groups: function(callback) {
            if (this.get('groups')) {
                return this.get('groups');
            }
            var groups = new GroupsForUser();
            groups.url = 'user/' + this.get('username') + '/groups';
            groups.fetch({success: callback});
        },
        parse: function(data) {
            return data.user;
        }
            
    });
    var Group = Backbone.Model.extend({
        idAttribute: 'name',
        urlRoot: '/group'
    });
    var GroupsForUser = Backbone.Collection.extend({
        model: Group,
        parse: function(data) {
            return _.map(data.groups, function(item){
                return {name: item};
            });
        }
    });
    return { User :  User,
             Group: Group,
             GroupsForUser: GroupsForUser
           };
});
