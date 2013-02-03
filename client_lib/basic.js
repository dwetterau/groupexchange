require(["jquery", 'underscore', 'backbone', 'client_models', 'client_views', "jquery.cookie"], function($, _, Backbone, client_models, client_views) {
    var login_view = client_views.login_view;
    login_view.render();
    $('body').append(login_view.el);
});
