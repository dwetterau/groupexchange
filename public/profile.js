function loadProfile() {
    if (!groupexchange.user || !groupexchange.loggedin) {
        $('body').empty();
        $('body').append('<div>You are not logged in.</div>');
    } else {
        var username = qs('u');
        if (username) {
            $.post('/userinfo', {   usersender : groupexchange.user.username, 
                                    usertarget : username  },
                                  function(data) { renderProfile(data) });
        } else {
            //Make a post request to get private profile info
            $.post('/userinfo', {   usersender : groupexchange.user.username, 
                                    usertarget : groupexchange.user.username  },
                                  function(data) { renderProfile(data) });
        }
    }
}

function renderProfile(data) {
    var user_name = data.firstname + ' ' 
                    + data.lastname;
    
    var name_element = document.createTextNode(user_name);
    name_element.id = 'user_name';

    $('body').append(name_element);
    
    var logout_element = document.createElement('a');
    $(logout_element).click(function() {
        logout();
        loadProfile();
    });
    logout_element.style.display = 'block';
    logout_element.innerText = 'Click to logout';
    logout_element.href = 'javascript:void(0);';
    
    $('body').append(logout_element);

    var contact_element = document.createElement('div');
    contact_element.id = 'contact_info';
    $(contact_element).append('<div id="username">Username: '+data.username+'</div>');
    $(contact_element).append('<div id="email">Email: '+data.email+'</div>');
    $(contact_element).append('<div id="reputation">Reputation: '+data.reputation+'</div>');
    
    $('body').append(contact_element);

    var group_element = document.createElement('div');
    group_element.id = 'groups';
    $(group_element).append('<div id="group_title">Groups:</div>');
    $('body').append(group_element);
    if (data.groups) {
        renderGroups(data.groups);
    }
    
    var transaction_element = document.createElement('div');
    transaction_element.id = 'transactions';
    $(transaction_element).append('<div id="transactions_title">Transactions:</div>');
    $('body').append(transaction_element);
    if (data.transactions) {
        renderTransactions(data.transactions);
    }
}

function renderGroups(group_list) { 
    $('#groups').append('<table border="1" id="group_table"></table>');
    var title_row = document.createElement('tr');
    title_row.id = 'group_title_row';
    addTextColumn(title_row, 'Name');
    addTextColumn(title_row, 'Number of members');
    $('#group_table').append(title_row);

    var i;
    for (i = 0; i < group_list['length']; i++) {
        $.post('/groupinfo', {  username    : groupexchange.user.username,
                                groupname   : group_list[i]},
            function(data) {
                var row = document.createElement('tr');
                row.id = data.name;
                var link = document.createElement('a');
                link.href = "javascript:void(0);";
                link.innerText = data.display_name;
                $(link).click(function() {
                    gotoGroup(data.name);
                });
                addColumn(row, link);
                addColumn(row, data.members['length']);
                $('#group_table').append(row);
        });
    }
}

function renderTransactions(transaction_list) {
    $('#transactions').append('<table border="1" id="transaction_table"></table>');
    var title_row = document.createElement('tr');
    title_row.id = 'transaction_title_row';
    addTextColumn(title_row, 'Created on');
    addTextColumn(title_row, 'Last updated');
    addTextColumn(title_row, 'Other User');
    addTextColumn(title_row, 'Amount');
    addTextColumn(title_row, 'Details');
    addTextColumn(title_row, 'Status');
    $("#transaction_table").append(title_row);

    var i;
    for (i = 0; i < transaction_list['length']; i++) {
        $.post('/transactioninfo', {    username : groupexchange.user.username,
                                        transaction: transaction_list[i]},
            function(data) {
                var row = document.createElement('tr');
                row.id = data.id;
                addTextColumn(row, (new Date(data.createTime)).toUTCString());
                addTextColumn(row, (new Date(data.lastModifiedTime)).toUTCString());
                if (data.username1 !== groupexchange.user.username) {
                    addTextColumn(row, data.username1); 
                } else if (data.username2 !== groupexchange.user.username) {
                    addTextColumn(row, data.username2);
                } else {
                    //TODO better aborting, also should check caps and stuff
                    return;
                }
                addTextColumn(row, '$' + data.amount); 
                if (data.details !== undefined) {
                    addTextColumn(row, data.details);
                } else {
                    addTextColumn(row, "None");
                }
                //Classify status.
                var status_element = resolveStatus(groupexchange.user.username, data);
                $(row).append(status_element); 
                
                $('#transaction_table').append(row);
            });
    }
}

function addColumn(row, ele) {
    var cell = document.createElement('td');
    $(cell).append(ele);
    $(row).append(cell);
}

function addTextColumn(row, text) {
    var cell = document.createElement('td');
    cell.innerText = text;
    $(row).append(cell);
}

function resolveStatus(username, data) {
    //This function determines whether an approve button should be added or not
    // 3 = waiting on user 1
    // 4 = waiting on user 2
    var cell = document.createElement('td');
    var addButton = false;
    var descriptive_text = "Waiting on other user to approve transaction";
    
    if (data.status == 5) {
        cell.innerText = "Completed"
        return cell;
    }

    if (username === data.username1) {
        if (data.status == 3 || data.status == 2) {
            addButton = true;
            if (data.direction) {
                descriptive_text = "Approve if you have sent the payment";
            } else {
                descriptive_text = "Approve if you have received the payment";
            }
        } 
    } else if (username === data.username2) {
        if (data.status == 1) {
            if (data.direction) {
                descriptive_text = "Approve if " + data.username1 + " owes you this";
            } else {
                descriptive_text = "Approve if you owe " + data.username1 + " this";
            }
        } else if (data.status == 4 || data.status == 2) {
            if (data.direction) {
                descriptive_text = "Approve if you have received the payment";
            } else {
                descriptive_text = "Approve if you have sent the payment";
            }
        }
        addButton = data.status == 1 || data.status == 2 || data.status == 4;
    } else {
        cell.innerText = "BAD TRANSACTION" //This should never happen
        return cell;
    }
    var description_div = document.createElement('div');
    description_div.innerText = descriptive_text;
    $(cell).append(description_div);
    if (addButton) {
        var buttonid = data.id + '_button';
        $(cell).append('<input type="button" value="Approve" id="' + buttonid + '">')
            .button()
            .click(function () {
                //Disable button
                $('#'+buttonid).attr("disabled", true);
                $.post('/advancetransaction',   { username : groupexchange.user.username, //TODO make this not spoofable
                                                  transaction : data.id },
                function () {
                    //update the page or something when the update has been sent.
                });
            });
    }
    return cell;
}

function gotoGroup(groupname) {
    var url = 'group.html?g=' + groupname;
    window.location = url;
}

$(window).bind('load', function() { loadProfile() });
