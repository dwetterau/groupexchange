var checker = require("./validator-min").check;

function check(input, type) {
    switch(type){
        case "username":
            checker(input).len(4,32);            
            break;
        case "name":
            checker(input).len(1,64);
            break;
        case "groupname":
            checker(input).len(4,64);
            break;
        case "transaction":
            checker(input).len(4,150);
            break;
        case "value":
            checker(input).isInt();
        case "password":
            checker(input).notNull();
            break;
        case "email":
            checker(input).len(6,256).isEmail();
            break;
        default:
            throw "Type not supported";
            break;
    }
}
exports.check = check;
