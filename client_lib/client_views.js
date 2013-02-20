define('client_views', ['backbone', 'underscore', 'jquery', 'client_models'], function(Backbone, _, $, client_models) {
    var logged_in_user;
    var app_events = _.clone(Backbone.Events);

    var SidebarView = Backbone.View.extend({
        tagName: "ul",
        entryTemplate: "<li><a href=<%= entry_url %>><%= entry_title %></a></li>",
        groups: [],
        render: function() {
            this.$el.empty();
            this.groups.each(function(group) {
                this.$el.append(_.template(this.entryTemplate, { entry_url: group.url(), entry_title: group.get('name')}));
            }, this);
        }
    });


    var MainView = Backbone.View.extend({
        initialize: function() {
            this.sidebar_view = new SidebarView();
        },

        // TODO: This is aweful
        template: "<div id='header'><%= header_content %></div>" +
            "<div class='container' id='main_content'></div>",
        header_content: '<a id="logout"> Logout </a>',

        events: {
            'click #logout' : 'logout'
        },
        
        render: function() {
            this.$el.html(_.template(this.template, {'header_content' : this.header_content}));
            this.$el.append(this.sidebar_view.el);
            this.sidebar_view.render();
            return this;
        },

        logout: function() {
            $.post('/logout', _.bind(function(data) {
                location.reload();
            }, this));
        },

        show: function() {
            if (!logged_in_user || logged_in_user.get('failed')) {
                logged_in_user = new client_models.User({username: 'me'});
                logged_in_user.fetch({
                    success: _.bind(function() {
                        if (logged_in_user.get('failed')) {
                            app_events.trigger("app:show-login");
                        } else {
                            // If user is logged in, then load main view
                            this.show();
                        }
                    }, this)
                });
                return;
            } else {
                logged_in_user.groups(_.bind(function(groups) {
                    this.sidebar_view.groups = groups;
                    this.sidebar_view.render();
                    this.render();
                    $('body').html(this.el);
                }, this));
            }
        }
   });

    var main_view = new MainView();
    
    var LoginView = Backbone.View.extend({
        error: '',
        fields: [
            {
                name: 'Email',
                type: 'text',
                required: 'required',
                css_class: 'input-block-level email_field'
            },
            {
                name: 'Password',
                type: 'password',
                required: 'required',
                css_class: 'input-block-level password_field'
            }
        ],
        template: function() {
            var fields_string = "";
            _.each(this.fields, function(val) {
                fields_string += '<input class="' + val.css_class +
                    '" type="'+ val.type +
                    '" required="' + val.required +
                    '" placeholder="' + val.name + '"></input>';
            });
            var total_string = "<form class='login-form floating-box'>" + 
            "<h3> (title pending) Login</h3>";
            total_string += fields_string;
            total_string += "<div class='error'><%=error%></div>" +
            "<button class='btn-large btn-primary' id='login_button' type='button'>Login</button>" +
            "<button class='btn-large' id='signup_button' type='button'>Signup</button>";
            return total_string;
        },

        className: 'container',

        render: function() {
            this.$el.html(_.template(this.template(), {'error' : this.error}));
            return this;
        },

        events: {
            'click #login_button' : 'sendLogin',
            'click #signup_button' : 'showSignup'
        },

        sendLogin: function() {
            $.post('/login',
                   {email: $('.email_field').val(), password: $('.password_field').val()},
                   _.bind(function (response) {
                       if (response.logged_in) {
                           var username = response.username;
                           this.$el.hide();
                           logged_in_user = new client_models.User({username: username});
                           logged_in_user.fetch({success: function() {
                               app_events.trigger("app:logged-in");
                           }});
                       } else {
                           this.error = response.error;
                           this.render();
                       }
                   }, this)
                  );
        },

        show: function() {
            this.render();
            $('body').html(this.$el);
        },
        
        showSignup: function() {
            this.$el.detach();
            app_events.trigger("app:signup");
        }
            
    });
    var login_view = new LoginView();

    var SignupView = Backbone.View.extend({
        error: '',
        fields: [
            {
                name: 'Email',
                type: 'text',
                required: 'email',
                css_class: 'input-block-level email_field'
            },
            {
                name: 'First Name',
                type: 'text',
                required: 'required',
                css_class: 'firstname_field'
            },
            {
                name: 'Last Name',
                type: 'text',
                required: 'required',
                css_class: 'input-small lastname_field'
            },
            {
                name: 'Password',
                type: 'password',
                required: 'required',
                css_class: 'input-block-level password_field'
            },
            {
                name: 'Repeat Password',
                type: 'password',
                required: 'required',
                css_class: 'input-block-level password_check'
            }
        ],
        template: function() {
            var fields_string = "";
            _.each(this.fields, function(val) {
                fields_string += '<input class="' + val.css_class +
                    '" type="'+ val.type +
                    '" required="' + val.required +
                    '" placeholder="' + val.name + '"></input>';
            });
            var total_string = "<form class='login-form floating-box'>" + 
            "<h3> Sign up for (title pending) </h3>";
            total_string += fields_string;
            total_string += "<div class='error'><%=error%></div>" +
            "<button href='#' class='btn-large btn-primary' id='signup_button'>Sign Up</button>" +
            "<button href='#' class='btn-large cancel'>Cancel</button>";
            return total_string;
        },
        
        className: 'container',

        render: function() {
            this.$el.html(_.template(this.template(), {'error' : this.error}));
            return this;
        },

        show: function() {
            this.render();
            $('body').html(this.$el);
        },
        
        events: {
            'click #signup_button': 'sendSignup',
            'click .cancel' : 'cancel',
            'change .password_field,.password_check' : 'checkSame'
        },

        sendSignup: function(e) {
            e.preventDefault();
            if (this.checkSame() !== true) {
                return;
            }
            var password = this.$('.password_field').val();
            var first_name = this.$('.firstname_field').val();
            var last_name = this.$('.lastname_field').val();
            var email = this.$('.email_field').val();
            $.post('/makeaccount', {
                email: email,
                password: password,
                firstname: first_name,
                lastname: last_name}).done(_.bind(function(response) {
                    if (response.success) {
                        logged_in_user = new client_models.User(response.user);
                        app_events.trigger("app:logged-in");
                    } else {
                        this.error = response.result;
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
            app_events.trigger("app:show-login");
        }
    });

    var signup_view = new SignupView();
            

            
    return { login_view: login_view,
             main_view: main_view,
             signup_view: signup_view,
             app_events: app_events
           };
});
