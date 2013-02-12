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
    user_groups: {
        db: 'groupmembers',
        name: 'groups',
        data: {
            map: function(doc) {
                emit(doc.user, doc.group);
            }
        }
    },
    all_transactions: {
        db: 'transactions',
        name: 'alltransactions',
        data: {
            map: function(doc) {
                emit(doc.sender, doc);
                emit(doc.receiver, doc);
            }
        }
    },
    user_transactions: {
        db: 'transactions',
        name: 'usertransactions',
        data: {
            map: function(doc) {
                emit([doc.sender, doc.receiver], doc);
                emit([doc.receiver, doc.sender], doc);
            }
        }
    },
    group_transactions: {
        db: 'transactions',
        name: 'grouptransactions',
        data: {
            map: function(doc) {
                emit([doc.sender, doc.group], doc);   
                emit([doc.receiver, doc.group], doc);   
            }
        }
    }
};
