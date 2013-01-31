exports.validations = {
    no_users_allowed: { db: 'users',
                        name: 'no_users',
                        code: function(newDoc, oldDoc, userCtx) {
                            throw ({forbidden: 'no way'});
                        }
                      }
};
