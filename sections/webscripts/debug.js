function getPassword() {
    const pathblock = window.location.pathname.split('/');
    return pathblock.pop();
};

function prefy(collection, name) {
    $(`#${name}`).text(JSON.stringify(collection, undefined, 2));
};

function initialize() {
    const password = getPassword();
    const url = '/api/v1/fbtrexdebug/' + password;
    $.getJSON(url, function(data) {
        /* it is expected having keys
       [ 'impressions', 'timelines', 'summary', 'metadata', 'impressions' ]
         * because they are also the name of the #pre in debug */
        _.each(data, prefy);
    });
};

