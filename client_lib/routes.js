define('routes', ['backbone', 'underscore', 'client_views'], function(Backbone, _, client_views) {
    var Router = Backbone.Router.extend({
        routes: {
            'login' : 'show_login',
            'logout' : 'show_logout',
            'main' : 'show_main',
            'signup' : 'show_signup',
            '.*' : 'show_main'
        },
        show_login: function() {
            client_views.login_view.show();
        },
        show_logout: function() {
            console.log("Logout!");
        },
        show_main: function() {
            client_views.main_view.show();
        },
        show_signup: function() {
            client_views.signup_view.show();
        }

    });
    var router = new Router();
    client_views.app_events.on("app:signup", function() {
        router.navigate('signup', true);
    });
    client_views.app_events.on("app:show-login", function() {
        router.navigate('login', true);
    });
    client_views.app_events.on("app:logged-in", function() {
        router.navigate('main', true);
    });
    Backbone.history.start();
    return {router: router};
});
