// Groups.js - api calls to create and manage groups

var check = require('../validate').check;
var utils = require('../utils');

function addUserToGroup(app, username, groupname, res) {
    link_object = {
        user: username,
        group: groupname
    };
    id = username+groupname;
    var groupmember_model = new app.GroupMember(id);
    groupmember_model.update(link_object);
    groupmember_model.save(function(body) {
        res.send({success: true});
        console.log("Added user '" + username + "' to group '" + groupname + "'");
    }, function(err) {
        res.send({error: err, success: false});
        console.log("Failed to add user '" + username + "' to group '" +
                    groupname + "'");
    });
}

exports.install_routes = function(app) {
    var auth = require('./auth')(app.User);
    app.get('/group/:name', auth.checkAuth, function(req, res) {
        var groupname = req.params.name;
        var username = req.user.username;
        var group = new app.Group(groupname);
        group.get_members(function(body) {
            var group_members = body.rows.map(function(row) { return row.value; });
            if (group_members.indexOf(username) == -1) {
                res.send({error: 'User not in group', success: false});
                return;
            }
            group.load(function(doc) {
                utils.cleanDoc(doc);
                res.send({group: doc, success: true});
            }, function(err) {
                res.send({error: err, success: false});
            });
        }, function(err) {
            res.send({error: err, success: false});
        });
    });

    // Creates a group
    app.post('/makegroup', auth.checkAuth, function(req, res) {
        var username = req.user.username;
        var groupname = req.body.groupname.toLowerCase();

        try {
            check(groupname, "groupname");
        } catch (e) {
            res.send({error: e.message, success: false});
            return;
        }

        var group_name_combined = username + '-' + groupname; 
        var group_model = new app.Group(group_name_combined);
        
        group_model.exists(function() { 
            res.send({error: 'Groupname is in use', success: false}); 
        }, function(err) {
            group_model.update({
                name: group_name_combined,
                display_name: groupname,
                owner: username
            });
            group_model.save(function(body) {
                console.log('Made new group='+group_name_combined);
                addUserToGroup(app, username, group_name_combined, res); 
            }, function(err) {
                res.send({error: 'Unable to make group at this time', success: false});
            });
        });
    });

    // Adds a user to a group
    app.post('/addgroup', auth.checkAuth, function (req, res) {
        var username = req.user.username;
        var groupname = req.body.groupname.toLowerCase();
        var user_to_add = req.body.useradd.toLowerCase();
        
        try {
            check(groupname, "groupname");
            check(user_to_add, "username");
        } catch (e) {
            res.send({error: e.message, success: false});
            return;
        }
        var group = new app.Group(groupname);
        group.get_members(function(body) {
            var group_members = body.rows.map(function(row) { return row.value; });
            if (group_members.indexOf(username) == -1) {
                res.send({error: 'User not in group', success: false});
                return;
            }
            if (group_members.indexOf(user_to_add) != -1) {
                res.send({error: 'User already in group', success: false});
                return;
            }
            user_to_add_model = new app.Personal(user_to_add);
            user_to_add_model.exists(function(body) {
                addUserToGroup(app, user_to_add, groupname, res);
            }, function(err) {
                res.send({error: 'Could not find user', success: false});
            });
        }, function(err) {
            res.send({error: err, success: false});
        });
    });

    app.get('/group/:groupname/members', auth.checkAuth, function(req, res) {
        var name = req.params.groupname;
        var username = req.user.username;
        var group = new app.Group(name);
        group.get_members(function(body) {
            var group_members = body.rows.map(function(row) { return row.value; });
            if (group_members.indexOf(username) == -1) {
                res.send({error: 'User not in group', success: false});
                return;
            } else {
                res.send({members: group_members, success: true});
            }
        }, function(err) {
            res.send({error: err, success: false});
        });
    });

    app.get('/user/:username/groups', auth.checkAuth, function(req, res) {
        var username_from_url = req.params.username;
        var username = req.user.username;
        if (username != username_from_url) {
            res.send({error: "You cannot view another user's groups", success: false});
            return;
        }
        var user = new app.Personal(username);
        user.get_groups(function(body) {
            var groups = body.rows.map(function(row) { return row.value; });
            res.send({groups: groups, success: true});
        }, function(err) {
            res.send({error: err, success: false});
        });
    });
};
