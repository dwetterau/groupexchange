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
        var groupname = parseInt(req.params.name); //May cause error?
        var username = req.user.get("id").toString();
        app.Group.load(groupname).then(function(group) {
            group.get_members(function(body) {
                var group_members = body.map(function(entry) { return entry.value.toString(); });
                if (group_members.indexOf(username) == -1) {
                    res.send({error: 'User not in group', success: false});
                    return;
                }
                group.set('members', group_members);
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
        var username = req.user.get('id').toString();
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
        var username = req.user.get('id').toString();
        var group_id = parseInt(req.body.groupname);
        var user_to_add = req.body.useradd.toLowerCase();
        
        try {
            check(group_id, "group_id");
            check(user_to_add, "username");
        } catch (e) {
            res.send({error: e.message, success: false});
            return;
        }
        app.Group.load(group_id).then(function(group) {
            group.get_members(function(body) {
                var group_members = body.map(function(entry) { return entry.value.toString(); });
                if (group_members.indexOf(username) == -1) {
                    res.send({error: 'User not in group', success: false});
                    return;
                }
                if (group_members.indexOf(user_to_add) != -1) {
                    res.send({error: 'User already in group', success: false});
                    return;
                }
                app.Personal.load(user_to_add).then(function(personal) {  
                    addUserToGroup(app, user_to_add, group_id, res);
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
        var name = parseInt(req.params.groupname);
        var username = req.user.get('id').toString();
        app.Group.load(name).then(function(group) {
            group.get_members(function(body) {
                var group_members = body.map(function(entry) { return entry.value.toString(); });
                if (group_members.indexOf(username) == -1) {
                    res.send({error: 'User not in group', success: false});
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
        var id = req.user.get('id').toString();
        if (id != id_from_url) {
            res.send({error: "You cannot view another user's groups", success: false});
            return;
        }
        app.Personal.load(id).then(function(user) {
            user.get_groups(function(body) {
                var groups = body.map(function(entry) { return entry.value; });
                res.send({groups: groups, success: true});
            }, function(err) {
                res.send({error: err, success: false});
            });
        }).fail(function(err) {
            res.send({error: err, success: false});
        });
    });
};
