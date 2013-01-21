// Basic site management functions
var nano = require('nano')('http://localhost:5984');

var commands = {
    createdb: { 
        help: 'creates required databases',
        code: function() {
            nano.db.create('users');
            nano.db.create('transactions');
            nano.db.create('groups');
            return;
        }
    }};

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
