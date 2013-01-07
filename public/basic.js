function init() {
    checklogin();
}

var groupexchange = {};

function checklogin() {
    var cookie = $.cookie("groupexchangename");
    if (cookie != null) {
        //parse the JSON cookie and make things pretty
        groupexchange.user = JSON.parse(cookie);
        console.log(groupexchange.user);
    } else {
        groupexchange.user = null;
    }
}

function logout() {
    //Delete the cookie
    $.cookie("groupexchangename", null);
    groupexchange.loggedin = false;
}

init();
