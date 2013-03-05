// Basic site management functions
var db = require('./db');
var nano = db.nano;
var views = require('./views');
var validations = require('./validations').validations;

db.ready(function(bucket) {
    var commands = {
        createdbs: { 
            help: 'creates required databases',
            code: function() {
                db.databases.forEach(function(database) {
                    nano.db.create(database);
                });
                return;
            }
        },
        dropdbs: {
            help: 'deletes all databases',
            code: function() {
                db.databases.forEach(function(database) {
                    nano.db.destroy(database);
                });
            }
        },
        addvalidations: {
            help: 'sends all validation functions to couchdb',
            code: function() {
                for (var validation_name in validations) {
                    var validation = validations[validation_name];
                    console.log('Installing validation ' + validation_name + ' to ' + validation.db);
                    db[validation.db].insert({validate_doc_update: validation.code},
                                             '_design/' + validation.name);
                }
            }
        },
        addviews: {
            help: 'sends all views to couchdb',
            code: function() {
                var document = views;
                document.language = 'javascript';
                // TODO: This will soon change to setDesignDoc
                console.log(JSON.stringify(document));
                bucket.createDesignDoc('default', document, function(err, meta) {
                    if (err) {
                        console.log("adding views failed with error: "  + err);
                    } else {
                        console.log("views added");
                    }
                });
            }
        },
        remakedbs: {
            help: 'alias for dropdbs, createdbs, addvalidations, addviews',
            code: function() {
                commands.dropdbs.code();
                commands.createdbs.code();
                commands.addvalidations.code();
                commands.addviews.code();
            }
        }

    };

    function print_help() {
        console.log('Possible commands are:');
        for (var func_name in commands) {
            console.log(func_name + ' : ' + commands[func_name].help);
        }
        process.exit(1);
        return;
    }

    if (process.argv.length < 3) {
        print_help();
    }

    var command = process.argv[2];


    if (commands[command] === undefined) {
        console.log(command + ' is not a valid command');
        print_help();
    }

    commands[command].code();
});
