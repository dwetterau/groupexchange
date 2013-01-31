define('client_views', ['backbone', 'underscore', 'jquery', 'client_models'], function(Backbone, _, $, client_models) {
    var logged_in_user;

    var MainView = Backbone.View.extend({
        template: "<span id='header'><%= header_content %></span>" +
            "<div id='sidebar_content'></div>" +
            "<div id='main_content'></div>",
        header_content: '',
        sidebar_view: function() {
            if(!this._sidebar_view) {
                this._sidebar_view = new SidebarView();
            }
            return this._sidebar_view;
        },
        
        render: function() {
            this.$el.html(_.template(this.template, {'header_content' : this.header_content}));
            this.$('#sidebar_content').append(this.sidebar_view().el);
            return this;
        },
        login : function(username) {
            logged_in_user = new client_models.User({'username' : username});
            logged_in_user.fetch().done(_.bind(function() {
                this.header_content = logged_in_user.get('firstname');
                this.$('#header').text(logged_in_user.get('firstname'));
                logged_in_user.groups(_.bind(function(groups) {
                    this.sidebar_view().groups = groups;
                    this.sidebar_view().render();
                }, this));
            }, this));
        }
    });

    var main_view = new MainView();
    
    var LoginView = Backbone.View.extend({
        // um, so yeah, this is probably dumb, but seems cool right now
        error: '',
        template: "<form id='login' action='login' method='post'>" +
            "<span id='login_error'><%= error %></span>" +
            "<label for='username'>Username: </label>" +
            "<input id='username_field' type='text' name='username' required='required'></input>" +
            "<label for='password'>Password:</label>" + 
            "<input id='password_field' type='password' name='password' required='required'></input>" +
            "<input id='login_button' type='button' value='Login'></input>" +
            "</form>",

        render: function() {
            this.$el.html(_.template(this.template, {'error' : this.error}));
            return this;
        },

        events: {
            'click #login_button' : function() {
                //perform login
                $.post('/login',
                       {username: $('#username_field').val(), password: $('#password_field').val()},
                       _.bind(function (val) {
                           debugger;
                           var response = $.parseJSON(val);
                           if (response.logged_in) {
                               var username = response.username;
                               main_view.login(username);
                           } else {
                               this.error = response.error;
                               this.render();
                           }
                       }, this)
                      );
                console.log('login done');
            }
        }
    });

    var SidebarView = Backbone.View.extend({
        tagName: "ul",
        entryTemplate: "<li><a href=<%= entry_url %>><%= entry_title %></a></li>",
        groups: [],
        render: function() {
            this.groups.each(function(group) {
                this.$el.append(_.template(this.entryTemplate, { entry_url: group.url(), entry_title: group.get('name')}));
            }, this);
        }
    });
            
    return { LoginView: LoginView,
             main_view: main_view
           };
});