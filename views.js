exports.views = {
    by_last_name: {
        db: 'users',
        name: 'by_last_name',
        data: {
            map: function(doc) {
                emit(doc.lastname, null);
            }
        }
    }
};
