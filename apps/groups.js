// Groups.js - api calls to create and manage groups

var check = require('../validate').check;
var utils = require('../utils');

function addUserToGroup(app, username, id, res) {
    link_object = {
        user: username,
        group: id
    };
    app.GroupMember.create(link_object).then(function(body) {
        res.send({success: true});
    }).fail(function(err) {
        res.send({error: err, success: false});
    });
}

exports.install_routes = function(app) {
    var auth = require('./auth')(app.User);
    app.get('/group/:name', auth.checkAuth, function(req, res) {
        var groupname = req.params.name;
        var username = req.user.username;
        app.Group.load(groupname).then(function(group) {
            group.get_members(function(body) {
                var group_members = body.rows.map(function(row) { return row.value; });
                if (group_members.indexOf(username) == -1) {
                    res.send({error: 'User not in group', success: false});
                    return;
                }
                utils.cleanDoc(group);
                group.members = group_members;
                res.send({group: group, success: true});
            }, function(err) {
                res.send({error: err, success: false});
            });
        }).fail(function(err) {
            res.send({error: err, success: false});
        });
    });

    // Creates a group
    app.post('/makegroup', auth.checkAuth, function(req, res) {
        var username = req.user.get('id');
        var groupname = req.body.groupname.toLowerCase();

        try {
            check(groupname, "groupname");
        } catch (e) {
            res.send({error: e.message, success: false});
            return;
        }
        var group_model = {
            name: groupname,
            owner: username
        };
        app.Group.create(group_model).then(function(group) {
            addUserToGroup(app, username, group.get('id'), res); 
        }).fail(function(err) {
            res.send({error: 'Unable to make group at this time', success: false});
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
        app.Group.load(groupname).then(function(group) {
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
                app.Personal.load(user_to_add).then(function(personal) {  
                    addUserToGroup(app, user_to_add, groupname, res);
                }).fail(function(err) {
                    res.send({error: 'Could not find user', success: false});
                });
            }, function(err) {
                res.send({error: err, success: false});
            });
        }).fail(function(err) {
            res.send({error: err, success: false});
        });   
    });

    app.get('/group/:groupname/members', auth.checkAuth, function(req, res) {
        var name = req.params.groupname;
        var username = req.user.username;
        app.Group.load(name).then(function(group) {
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
        }).fail(function(err) {
            res.send({error: err, success: false});
        });
    });

    app.get('/user/:id/groups', auth.checkAuth, function(req, res) {
        var id_from_url = req.params.id;
        var id = req.user.get('id');
        if (id != id_from_url) {
            res.send({error: "You cannot view another user's groups", success: false});
            return;
        }
        app.Personal.load(username).then(function(user) {
            user.get_groups(function(body) {
                var groups = body.rows.map(function(row) { return row.value; });
                res.send({groups: groups, success: true});
            }, function(err) {
                res.send({error: err, success: false});
            });
        }).fail(function(err) {
            res.send({error: err, success: false});
        });
    });
};
