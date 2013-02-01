exports.views = {
    by_last_name: {
        db: 'users',
        name: 'by_last_name',
        data: {
            map: function(doc) {
                emit(doc.lastname, null);
            }
        }
    },
    group_members: {
        db: 'groupmembers',
        name: 'members',
        data: {
            map: function(doc) {
                emit(doc.group, doc.user);
            }
        }
    },
    transactions: {
        db: 'transactions',
        name: 'usertransactions',
        data: {
            map: function(doc) {
                emit(doc.username1, doc);
                emit(doc.username2, doc);
            }
        }
    }
};
