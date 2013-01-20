require(["jquery", "jquery.cookie"], function($) {
function init() {
    checklogin();
}

var groupexchange = {};

function checklogin() {
    var cookie = $.cookie("groupexchangename");
    if (cookie != null) {
        //parse the JSON cookie and make things pretty
        groupexchange.user = JSON.parse(cookie);
        groupexchange.loggedin = true;
        console.log(groupexchange.user);
    } else {
        groupexchange.user = null;
        groupexchange.loggedin = false;
    }
}

function logout() {
    //Delete the cookie
    $.cookie("groupexchangename", null);
    groupexchange.loggedin = false;
}

init();
});
