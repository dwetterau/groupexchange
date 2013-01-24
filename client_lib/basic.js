require(["jquery", 'underscore', 'backbone', 'client_models', 'client_views', "jquery.cookie"], function($, _, Backbone, client_models, client_views) {
    var main_view = client_views.main_view;
    main_view.render();
    $('body').append(main_view.el);
    var login_view = new client_views.LoginView();
    login_view.render();
    $('#main_content').append(login_view.el);
/*function init() {
    checklogin();
}

var groupexchange = {};


function logout() {
    //Delete the cookie
    $.cookie("groupexchangename", null);
    groupexchange.loggedin = false;
}

function qs(key) {
    key = key.replace(/[*+?^$.\[\]{}()|\\\/]/g, "\\$&"); // escape RegEx meta chars
    var match = location.search.match(new RegExp("[?&]"+key+"=([^&]+)(&|$)"));
    return match && decodeURIComponent(match[1].replace(/\+/g, " "));
}
    var u = new client_models.User();
    u.set('username', 'adam');
    u.fetch();

init();*/
});
