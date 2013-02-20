// Utils.js - random functions that are applicable everywhere

//Takes a couchDB doc and removes the private couchdb info from it
// The doc itself has private couchDB stuff that Idk if we want to expose...
function cleanDoc(doc) {
    doc._rev = undefined;
    doc._id = undefined;
}

exports.cleanDoc = cleanDoc;
