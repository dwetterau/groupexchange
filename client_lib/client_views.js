define('client_views', ['backbone', 'underscore', 'jquery', 'client_models'], function(Backbone, _, $, client_models) {
    var logged_in_user;

    var MainView = Backbone.View.extend({
        template: "<div id='header'><%= header_content %></div>" +
            "<div id='sidebar_content'></div>" +
            "<div class='container' id='main_content'></div>",
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
            this.render();
            logged_in_user = new client_models.User({'username' : username});
            logged_in_user.fetch().done(_.bind(function() {
                this.header_content = logged_in_user.get('firstname');
                this.$('#header').text(logged_in_user.get('firstname'));
                logged_in_user.groups(_.bind(function(groups) {
                    this.sidebar_view().groups = groups;
                    this.sidebar_view().render();
                    $('body').append(this.el);
                }, this));
            }, this));
        }
    });

    var main_view = new MainView();
    
    var LoginView = Backbone.View.extend({
        // um, so yeah, this is probably dumb, but seems cool right now
        error: '',
        template: "<form class='login-form floating-box'>" +
            "<h3> (title pending) Login</h3>" +
            "<span id='login_error'><%= error %></span>" +
            "<input class='input-block-level' id='username_field' type='text' name='username' required='required' placeholder='Email'></input>" +
            "<input class='input-block-level' id='password_field' type='password' name='password' required='required' placeholder='Password'></input>" +
            "<label class='checkbox'><input type='checkbox' value='remember-me'> Remember me</label>" +
            "<button class='btn-large btn-primary' id='login_button' type='button'>Login</button>" +
            "<button class='btn-large' id='signup_button' type='button'>Sign Up</button>" +
            "</form>",
        className: 'container',

        render: function() {
            this.$el.html(_.template(this.template, {'error' : this.error}));
            return this;
        },

        events: {
            'click #login_button' : 'sendLogin',
            'click #signup_button' : 'showSignup'
        },

        sendLogin: function() {
            $.post('/login',
                   {username: $('#username_field').val(), password: $('#password_field').val()},
                   _.bind(function (val) {
                       var response = $.parseJSON(val);
                       if (response.logged_in) {
                           var username = response.username;
                           this.$el.hide();
                           main_view.login(username);
                       } else {
                           this.error = response.error;
                           this.render();
                       }
                   }, this)
                  );
            console.log('login done');
        },

        showSignup: function() {
            this.$el.detach();
            signup_view.render();
            $('body').append(signup_view.$el);
        }
            
    });
    var login_view = new LoginView();

    var SignupView = Backbone.View.extend({
        error: '',
        template: "<form class='login-form floating-box'>" +
            "<h3> Sign up for (title pending) </h3>" +
            "<input class='input-block-level username_field' type='text' required='required' placeholder='Email'></input>" +
            "<input class='input-block-level password_field' type='password' required='required' placeholder='Password'></input>" +
            "<input class='input-block-level password_check' type='password' required='required' placeholder='Repeat Password'></input>" +
            "<div class='error'><%=error%></div>" +
            "<button href='#' class='btn-large btn-primary' id='signup_button'>Sign Up</button>" +
            "<button href='#' class='btn-large cancel'>Cancel</button>",
        className: 'container',

        render: function() {
            this.$el.html(_.template(this.template, {'error' : this.error}));
            return this;
        },
        
        events: {
            'click #signup_button': 'sendSignup',
            'click .cancel' : 'cancel',
            'change .password_field,.password_check' : 'checkSame'
        },

        sendSignup: function() {
            if (this.checkSame() !== true) {
                return;
            }
            var username = this.$('.username_field').val();
            var password = this.$('.password_field').val();
            $.post('/makeaccount',
                   {username: username,
                    email: username,
                    password: password,
                    firstname: 'Robert',
                    lastname: 'Test'}).done(_.bind(function(response) {
                        var resp = JSON.parse(response);
                        if (resp.success) {
                            main_view.login(username);
                        } else {
                            this.error = resp.result;
                            this.render();
                        }
                    }, this));
        },

        checkSame: function() {
            var password = this.$('.password_field').val();
            var check = this.$('.password_check').val();
            if (password != check) {
                this.error = 'Passwords do not match';
                this.$('.error').text(this.error);
                return false;
            }
            this.error = '';
            this.$('.error').text(this.error);
            return true;
        },

        cancel: function() {
            this.$el.detach();
            login_view.render();
            $('body').append(login_view.$el);
        }
    });

    var signup_view = new SignupView();
            

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
            
    return { login_view: login_view,
             main_view: main_view
           };
});
