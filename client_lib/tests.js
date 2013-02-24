window.testing = true;
define('tests', ['jasmine', 'jquery', 'client_views', 'routes'], function(jasmine, $, client_views, routes) {

    function mock_jquery(result) {
        spyOn($, 'ajax').andCallFake(function(options) {
            options.success(result);
        });
    }
    
    describe('App view events', function() {
        var main_view = client_views.main_view;
        var login_view = client_views.login_view;
        var app_events = client_views.app_events;
        var router = routes.router;

        beforeEach(function() {
            // Don't want to be redirected, ever
            spyOn(router, 'navigate');
            // Don't want to replace html on page
            spyOn($('body'), 'html');
        });
            
        
        // Events are triggered when they should be
        it('Should trigger login when not logged in', function() {
            spyOn(app_events, 'trigger');
            mock_jquery({success: false, user: {}});
            main_view.show();
            expect(app_events.trigger).toHaveBeenCalledWith("app:show-login");
        });
        it('Should trigger logged-in after login', function() {
            spyOn(app_events, 'trigger');
            mock_jquery({success: true, user: {}, logged_in: true});
            login_view.sendLogin();
            expect(app_events.trigger).toHaveBeenCalledWith("app:logged-in");
        });

        // Correct actions are taken when events are triggered
        it('Should show main_view on logged-in', function() {
            app_events.trigger('app:logged-in');
            expect(router.navigate).toHaveBeenCalledWith('main', true);
        });

            
    });
});
