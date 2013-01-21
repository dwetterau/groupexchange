function loadGroup() {
    if (!groupexchange.user || !groupexchange.loggedin) {
        $('body').empty();
        $('body').append('<div>You are not logged in.</div>');
    } else {
        var groupname = qs('g');
        if (groupname) {
            $.post('/groupinfo', {  username : groupexchange.user.username, 
                                    groupname : escape(groupname)   },
                                function(data) { renderGroup(data) });
        } else {
            $('body').empty();
            $('body').append("<div>Didn't find group are not logged in.</div>");
        }
    }
}

function renderGroup(data) {
    console.log(data);
    var group_name_element = document.createElement('div');
    group_name_element.id = 'group_name';
    group_name_element.innerText = data.display_name;
    $('body').append(group_name_element);

    var members_element = document.createElement('div');
    for (var i = 0; i < data.members.length; i++) {
        var member_link = document.createElement('a');
        member_link.innerText = data.members[i];
        member_link.href = "javascript:void(0);";
        var index = i;
        $(member_link).click(function() {
            gotoProfile(data.members[index]);
        });
        member_link.style.display = 'block';
        $(members_element).append(member_link);
    }
    $('body').append(members_element);
}

function gotoProfile(username) {
    var url = '/profile.html?u=' + username;
    window.location = url;
}

$(window).bind('load', function() { loadGroup() });
