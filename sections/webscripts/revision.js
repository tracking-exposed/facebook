/*
var parsers = [
    'postType',
    'feedBasicInfo',
    'feedUTime',
    'feedReactions',
    'promotedInfo',
    'promotedLink',
    'promotedTitle',
    'feedText',
    'feedHref',
    'imgAltTag'
];

function getParserHref(parserName) {
    return _.reduce(parsers, function(memo, p) {
        if(memo)
            return memo;
        if(p == parserName)
            return 'https://github.com/tracking-exposed/facebook/blob/master/parsers/' + p + '.js';
    }, undefined);
};

function getParserByBool(parserName) {
    var href = getParserHref(parserName);
    return '<a href="' + href + '" target="_blank">' + parserName + '</a>';
}

function failOrSuccess(value) {
    if(value) {
        return '<span class="metaresult success">☑ </span>';
    } else {
        return '<span class="metaresult failure">☒ </span>';
    }
};


function doHTMLentries(dictionary) {
    return _.flatten(_.map(dictionary, function(value, key) {
        if(_.isBoolean(value)) {
            return [ '<li>', failOrSuccess(value), getParserByBool(key) + '</li>' ];
        }
        if(key === 'savingTime') {
            var D = moment.duration(
                        moment() - moment(value, moment.ISO_8601)
                    ).humanize();
            return [ '<li>', '<span class="times">saved ', D, ' ago.', '</li>' ];
        }
        return ['<li>', '<b>', key, '</b>:',
            '<span class="metaentry">', value, '</span>',
        '</li>'];
    })).join('');
};

function cleanstyle(){
    $('.realitycontainer img').attr('width','');
    $('.realitycontainer img').attr('height','');
}

function loadsnippet(metadataContainer, renderContainer) {

    var htmlId = document.location.pathname.split('/').pop();
    if(htmlId.length == 40) {
        var url = '/api/v2/debug/html/' + htmlId;
    } else {
        console.error("htmlId not found");
        console.log(document.location);
    }
    console.log(url);

    $.getJSON(url, function(something) {
        console.log("Metadata[s] " + JSON.stringify(something.metadata));
         
        var content= something.html;
        
       //qui lo fa giusto ma mi manca una regexp per finire
       // content = content.replace('width="'+ +'"', '');
        
        $(renderContainer).html(content);
        $(metadataContainer).html(
            '<ul class="fb--icon-list">' +
            doHTMLentries(something.metadata) +
            '</ul>'
        );
        $('#bymeta').attr('href', '/revision/' + something.metadata.id);
        $('#bysnippet').attr('href', '/revision/' + something.metadata.id);

        //qui lo fa però su tutta la pagina :(
        cleanstyle();
    });
};
*/

function loadmetadata(metadataC, errorsC, renderC) {
    var htmlId = document.location.pathname.split('/').pop();
    if(htmlId.length !== 40) {
        $(metadataC).html('<h1>URL error!?</h1>');
        $(errorsC).html('<h3>check impressionId</h3>');
        return;
    }

    var url = `/api/v2/debug/html/${htmlId}`;
    console.log(url);

    $.getJSON(url, function(data) {
        console.log(data);
    });
};

/*
function bydate(metadataContainer, renderContainer, datecontainer) {


    const x = document.location.pathname.split('/');

    console.log(x);

    $.getJSON(url, function(something) {
        console.log("Metadata[s] " + JSON.stringify(something.metadata));
         
        var content= something.html;
        
       //qui lo fa giusto ma mi manca una regexp per finire
       // content = content.replace('width="'+ +'"', '');
        
        $(renderContainer).html(content);
        $(metadataContainer).html(
            '<ul class="fb--icon-list">' +
            doHTMLentries(something.metadata) +
            '</ul>'
        );
        $('#bymeta').attr('href', '/revision/' + something.metadata.id);
        $('#bysnippet').attr('href', '/revision/' + something.metadata.id);

        //qui lo fa però su tutta la pagina :(
        cleanstyle();
    });
};

*/
