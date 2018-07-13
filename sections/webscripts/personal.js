/*
 * This file contain the code executed in /personal/$userToken/$sectionType
 */

var pageMap = {
    diet: '#dietSection',
    data: '#dataSection',
    csv: '#csvSection',
    knowmore: '#knowMoreSection',
    publications: '#publicationSection'
};

function getURLinfo() {
    var pathblock = window.location.pathname.split('/');
    var pageName = pathblock.pop();
    var userToken = pathblock.pop();
    console.log("getURLinfo →  token", userToken, "pageName", pageName);
    return {
        userToken: userToken,
        pageName: pageName
    };
};

function switchpage(e) {

    var nextSection = _.get(pageMap, e.currentTarget.id);
    console.log("clicked switchpage to", nextSection);

    /* the pages are already initialized, it is just enough hide/display
     * the right one */
    showandhidesections(nextSection, e.currentTarget.id);
}

function showandhidesections(containerId, navBarId) {

    console.log("showandhidesections of", navBarId, "in", containerId);

    $('li').removeClass('active');
    $('li #' + navBarId).addClass('active');

    $(".pageSection").addClass('hidden');
    $(containerId).removeClass('hidden');

    history.pushState( {}, '', navBarId);
};

window.addEventListener('popstate', function(event) {
    console.log("popstate, loading page from location");
    var pinfo = getURLinfo();
    var sectionName = _.get(pageMap, pinfo.pageName);
    showandhidesections(sectionName, pinfo.pageName);
}, false);

/* the variables keeping the API results, so pages can render without
 * requesting them again. soon or later we'll migrate to ServiceWorkers,
 * but until that moment: amen */

var firstBatch = null;
var sources = null;
var currentlyLoaded = null;
var nextBatch = 100;

function initialize() {

    var pinfo = getURLinfo();

    var sectionName = _.get(pageMap, pinfo.pageName);
    console.log("loadpage → ", sectionName);
    var days = 20;

    $(".switch").click(switchpage);
    $('li #' + pinfo.pageName).addClass('active');

    var basicApi = "/api/v1/htmls/" + pinfo.userToken + "/days/" + days;
    console.log("Loading first batch of data from", basicApi);

    $.getJSON(basicApi, function(data) {

        console.log("received `htmls` objects: ", _.size(data));

        /* remind: firstBatch and souces are global */
        firstBatch = data;

        /* initialize Raw data section */
        loadHTMLs(pinfo.userToken, '#contributionBlock', _.reverse(firstBatch), 0);

        /* initialize CSV section */
        /* initialize knowmore section */
        /* initialize publication section */

        /* finally, render the page requested */
        $("#loader").addClass('hidden');
        showandhidesections(sectionName, pinfo.pageName);
    });

    /* initialize the two graph in `diet` */
    var dietURL = '/api/v1/personal/diet/' + pinfo.userToken + '/' + days;
    $.getJSON(dietURL, function(data) {
        var repetitionRanks = '#insist';
        console.log("received `htmls` for `diet`", _.size(data.info));

        var repetition = _.map(data.byPostId, function(amount, pid) {
            var p = _.first(_.filter(data.info, { postId: pid }));
            return{
                post: p,
                amount: amount
            };
        });

        var html = "";
        var last = null;
        _.each(_.reverse(_.orderBy(repetition, 'amount')), function(o) {

            if(last !== o.amount) {
                last = o.amount;
                html = html + createAmount('Posts appeared ', o.amount);
            }

            html = html + createCard({
                header: o.post.source,
                when: o.post.publicationUTime,
                link: o.post.permaLink,
                kind: o.post.hrefType,
                id: o.post.id
            });
        });
        $(repetitionRanks).html(html);

        /* fill the source selection graph */
        var sourceRanks = '#sources';

        var postref = _.map(_.groupBy(data.info, 'postId'), function(parray, pid) {
            var post = _.first(parray);
            post.repeated = _.size(parray);
            return post;
        });

        var selected = _.reduce(data.bySource, function(memo, amount, name) {
            memo.push({ amount: amount, name: name });
            return memo;
        }, []);

        last = null;
        html = "";
        _.each(_.reverse(_.orderBy(selected, 'amount')), function(o) {

            if(last !== o.amount) {
                last = o.amount;
                html = html + createAmount(o.name + ' ', o.amount);
            }
            var posts = _.filter(postref, { source: o.name });
            html = html + createBlockBySource(posts, o.name);
        });
        $(sourceRanks).html(html);

        /* onClick events */
        $(".fbspecial").on('click', function() {
            var x = $(this).attr('id');
            $(this).html('<a target="_blank" href="https://www.facebook.com' + x + '">opening on Facebook?</a>');
        });

        $(".card").on('click', function() {
            $('.selected').removeClass('selected');
            var x = $(this).attr('id');
            $(this).addClass('selected');
            $(".middle-loader").removeClass('hidden');
            $.getJSON("/api/v1/html/" + x, function(evidence) {

                var refwidth = $('.col-sm-4').width() - 10;
                $('#details').html(evidence.html);

                $('#details > img').removeAttr('width');
                $('#details > img').removeAttr('alt width');

                $('#details > img').attr('width', refwidth);
                $('#details').css('cssText', 'width' + refwidth + 'px !important');

                $(".middle-loader").addClass('hidden');

                $('html,body').animate({
                    scrollTop: $("#details").offset().top
                }, 'slow');

            });
        });
    });
};

function createBlockBySource(posts, name) {

    var whole = _.map(posts, function(d) {
        var timeago = moment.duration( moment() - moment(d.publicationUTime) ).humanize() + ' ago';
        var kindology = getKindIcon(d.hrefType);

        var content =
            '<div class="header"><span class="ours">from:</span> '+ d.source +  
                '<span class="fbspecial" id="'+ d.permaLink +'"><span class="glyphicon glyphicon-log-out"></span></span>' + 
            '</div><span class="ours"> display: ' + d.repeated + ' time' + (d.repeated === 1 ? "" : "s") + '</span> ' + 
            '<span class="kind"> ' + kindology + '</span>' +
            '<span class="ours">Published: </span>' + timeago;

        return '<div class="card" id="' + d.id +'">'+ content + '</div>';
    });

    return whole.join('');
}

function createCard(d) {

    var timeago = moment.duration( moment() - moment(d.when) ).humanize() + ' ago';
    var kindology = getKindIcon(d.kind);

    var content = 
        '<div class="header"><span class="ours">from:</span> '+ d.header + 
            '<span class="fbspecial" id="'+ d.link +'"><span class="glyphicon glyphicon-log-out"></span></span>' + 
        '</div>' +
        '<div class="time"><span class="kind">' + kindology + '</span>' +
        '<span class="ours">Published: </span>' + timeago + '</div>';

    return '<div class="card" id="' + d.id +'">'+ content + '</div>';
}

function getKindIcon(kind) {
    if(kind === 'post')
        return '<span class="glyphicon glyphicon-align-left"></span>';
    else if(kind === 'photo')
        return '<span class="glyphicon glyphicon-picture"></span>';
    else if(kind === 'video')
        return '<span class="glyphicon glyphicon-facetime-video"></span>';
    else
        return '💥' + kind + '💥' 
}

function createAmount(label, amount) {
    return '<div class="amount">' + label + amount + ' times</div>';
}

function loadNextHTMLs(containerId) {
    var pinfo = getURLinfo();
    var url = "/api/v1/htmls/" + pinfo.userToken + '/n/' + _.size(firstBatch) + '/' + nextBatch;

    $.getJSON(url, function(collection) {
        var start = _.size(firstBatch);

        loadHTMLs(pinfo.userToken, containerId, collection, start);
        firstBatch = _.concat(firstBatch, collection);
        console.log("completed loadNextHTMLs", _.size(collection));
    });
};

function loadHTMLs(userToken, containerId, collection, cnt) {

    _.each(_.reverse(collection), function(entry, i) {
        var prettyHtml = '<a href="/revision/' + entry.id + '" target="_blank">🔗 original </a>';

        if(entry.type === 'promoted')
            prettyHtml += promotedFormat(entry);
        else if(entry.type === 'feed' ) {
            prettyHtml += feedFormat(entry);
            if(entry.hrefType === 'post')
                prettyHtml += postText(entry);
        } else
            prettyHtml += unprocessedFormat(entry);

        $(containerId).append('<div class="entry">' + '<span class="num">' + (i + 1 + cnt) + '</span>' + prettyHtml + '</div>');
    });
};

function promotedFormat(entry) {
    var distance = moment.duration(moment() - moment(entry.savingTime)).humanize();
    var promotedPrefix = '<span class="prefix promoted">﴿ promoted</span>';
    if(entry.promotedTitle && entry.promotedInfo)
       var promotedInfo = '<a target="_blank" href="' + entry.ownerName + '"class="ownerName">' + entry.title + '</a>';
    else
       var promotedInfo = '<span class="error">fail in extracting promoted Info</span>';

    return promotedPrefix + '<span class="promoted">' + distance + ' ago, </span>' + promotedInfo;
};

/* In theory, we can regulate here the print of 'Hour:minute day' if is in the last 24 hour, or 'Hour day/month' if older,
 * specially, some posts are more than 1 year old. In such cases, printing the YYYY is necessary */
function formatByDistance(entry) {
    return 'HH:mm DD MMMM';
}

function feedInfo(entry) {

    var fmtStr = formatByDistance(entry.publicationUTime);
    var retT = "";
    if(entry.feedUTime && entry.permaLink)
        retT += 'posted on <a href="https://www.facebook.com'+ entry.permaLink +'" target="_blank">' + moment(entry.publicationUTime * 1000).format(fmtStr) + '</a>';
    if(entry.hrefType === 'groupPost')
        retT += ' <b>post from a Group</b>';
    else if(entry.hrefType === 'photo')
        retT += ' <b>photo</b>';
    else if(entry.hrefType === 'photo')
        retT += ' <b>video</b>';
    else if(entry.hrefType)
        retT += " <b>" + entry.hrefType + "</b>";

    return retT;
};

function postText(entry) {
    var R = "<span class='promoted'>" + entry.source + "</span>";
    if(entry.text)
        R += "<small> " + entry.text + "</small>";
    return R;
};

function feedFormat(entry) {
    var distance = moment.duration(moment() - moment(entry.savingTime)).humanize();
    var feedPrefix = '<span class="prefix">⧼ newsfeed</span>';
    var info = feedInfo(entry);
    return feedPrefix + '<span class="feed">Saved ' + distance + ' ago — ' + info + '</span>';
};

function unprocessedFormat(entry) {
    var distance = moment.duration(moment() - moment(entry.savingTime)).humanize();
    var unpPrefix = '<span class="unprocessed">unprocessed</span>';
    return unpPrefix + '<span class="feed">Saved ' + distance + ' ago </span>';
};

function downloadCSV(type) {
    var pinfo = getURLinfo();
    var url = "/api/v1/personal/csv/" + pinfo.userToken + "/" + type;
    console.log(url);
    window.open(url);
};
