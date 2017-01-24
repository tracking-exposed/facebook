
function getParserHref(parserName) {
    /* there is a pattern as you see... but I'm not completely sure, so, sloppy code ATM */
    if(parserName === 'postType') {
        return 'https://github.com/tracking-exposed/facebook/blob/master/parsers/postType.js';
    } else if(parserName === 'feedBasicInfo') {
        return 'https://github.com/tracking-exposed/facebook/blob/master/parsers/feedBasicInfo.js';
    } else if(parserName === 'feedReactions') {
        return 'https://github.com/tracking-exposed/facebook/blob/master/parsers/feedReactions.js';
    } else if(parserName === 'promotedInfo') {
        return 'https://github.com/tracking-exposed/facebook/blob/master/parsers/promotedInfo.js';
    } else if(parserName === 'promotedLink') {
        return 'https://github.com/tracking-exposed/facebook/blob/master/parsers/promotedLink.js';
    } else if(parserName === 'promotedTitle') {
        return 'https://github.com/tracking-exposed/facebook/blob/master/parsers/promotedTitle.js';
    }
};

function getParserByBool(parserName) {
    var href = getParserHref(parserName);
    return '<a href="' + href + '" target=_blank>' + parserName + '</a>';
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
        /* TODO manage all the dates in the same way */
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
    $('img').attr('width','');
    $('img').attr('height','');
    $('*').attr('style','');
}

function loadsnippet(metadataContainer, renderContainer) {

    var days = _.parseInt($('#days').val());
    var skips = _.parseInt($('#skips').val());

    var url = '/api/v1/html/ago/' + days + '/' + skips;
    console.log(url);

    $.getJSON(url, function(something) {
        console.log("Metadata[s] " + JSON.stringify(something.metadata));
         
       // 
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


