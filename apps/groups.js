// Groups.js - api calls to create and manage groups

var db = require('../db');
var auth = require('./auth');
var check = require('../validate').check;

function addUserToGroup(username, groupname, res) {
    link_object = {
        user: username,
        group: groupname
    };
    db.groupmembers.insert(link_object, username+groupname, function(err, body) {
        if (err) {
            res.send({error: err, success: false});
            console.log("Failed to add user '" + username + "' to group '" +
                        groupname + "'");
        } else {
            res.send({success: true});
            console.log("Added user '" + username + "' to group '" + groupname + "'");
        }
    });
}

exports.install_routes = function(app) {
    app.get('/group/:name', auth.checkAuth, function(req, res) {
        var name = req.params.name;
        var username = req.user.username;
        db.groupmembers.view('members', 'members', {keys: [name]}, function(err, body) {
            if (err) {
                res.send({error: err, success: false});
                return;
            }
            var group_members = body.rows.map(function(row) { return row.value; });
            if (group_members.indexOf(username) == -1) {
                res.send({error: 'User not in group', success: false});
                return;
            }
            db.groups.get(name, function(err, doc) {
                if (err) {
                    res.send({error: err, success: false});
                } else {
                    utils.cleanDoc(doc);
                    res.send({group: doc, success: true});
                }
            });
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
        db.groups.head(group_name_combined, function(err, body) {
            if (!err) {
                res.send({error: 'Groupname is in use', success: false}); //Aka this user has already created a group with this name
            } else {
                var groupObject = {
                    name: group_name_combined,
                    display_name: groupname,
                    owner: username
                };
                db.groups.insert(groupObject, group_name_combined, function(err, body) {
                    if (!err) {
                        console.log('Made new group='+group_name_combined);
                        addUserToGroup(username, group_name_combined, res); 
                    } else {
                        res.send({error: 'Unable to make group at this time', success: false});
                    }
                });
            }
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
        
        db.groupmembers.view('members', 'members', {keys: [groupname]}, function(err, body) {
            if (err) {
                res.send({error: err, success: false});
                return;
            }
            var group_members = body.rows.map(function(row) { return row.value; });
            if (group_members.indexOf(username) == -1) {
                res.send({error: 'User not in group', success: false});
                return;
            }
            if (group_members.indexOf(user_to_add) != -1) {
                res.send({error: 'User already in group', success: false});
                return;
            }
            //Check to see if the user actually exists
            db.users.head(user_to_add, function(err, body) {
                if (!err) {
                    addUserToGroup(user_to_add, groupname, res);
                } else {
                    res.send({error: 'Could not find user', success: false});
                }
            });
        });
    });


    app.get('/group/:name/members', auth.checkAuth, function(req, res) {
        var name = req.params.name;
        var username = req.user.username;
        db.groupmembers.view('members', 'members', {keys: [name]}, function(err, body) {
            if (err) {
                res.send({error: err, success: false});
                return;
            }
            var group_members = body.rows.map(function(row) { return row.value; });
            if (group_members.indexOf(username) == -1) {
                res.send({error: 'User not in group', success: false});
                return;
            } else {
                res.send({members: group_members, success: true});
            }
        });
    });

    app.get('/user/:username/groups', auth.checkAuth, function(req, res) {
        var name = req.params.username;
        var username = req.user.username;
        if (username != name) {
            res.send({error: "You cannot view another user's groups yet", success: false});
            return;
        }
        db.groupmembers.view('groups', 'groups', {keys: [name]}, function(err, body) {
            if (err) {
                res.send({error: err, success: false});
                return;
            }
            var groups = body.rows.map(function(row) { return row.value; });
            res.send({groups: groups, success: true});
        });
    });
};
