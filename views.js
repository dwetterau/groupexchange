exports.views = {
    by_last_name: {
        map: "function(doc) {if (doc.type == 'user') {emit(doc.lastname, null);}}"
    },
    group_members: {
        map: "function(doc) {if (doc.type == 'groupmember') {emit(doc.group, doc.user);}}"
    },
    user_groups: {
        map: "function(doc) {if (doc.type == 'groupmember') {emit(doc.user, doc.group);}}"
    },
    all_transactions: {
        map: "function(doc) {if (doc.type == 'transaction') {emit(doc.sender, doc); emit(doc.receiver, doc);}}"
    },
    user_transactions: {
        map: "function(doc) {if (doc.type == 'transaction') {emit([doc.sender, doc.receiver], doc); emit([doc.receiver, doc.sender], doc);}}"
    },
    group_transactions: {
        map: "function(doc) {if (doc.type == 'transaction') {emit([doc.sender, doc.group], doc); emit([doc.receiver, doc.group], doc);}}"
    }
};
