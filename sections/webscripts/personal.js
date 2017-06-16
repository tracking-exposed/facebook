/*
 * This file contain the code executed in /realitycheck/$userId/$sectionType
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
    var userId = _.parseInt(pathblock.pop());
    console.log("getURLinfo → userId", userId, "pageName", pageName);
    return {
        userId: userId,
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

    $(".switch").click(switchpage);
    $('li #' + pinfo.pageName).addClass('active');

    var basicApi = "/api/v1/htmls/" + pinfo.userId + "/days/" + 37;
    console.log("Loading first batch of data from", basicApi);

    return $.getJSON(basicApi, function(data) {

        console.log("loaded now:", _.size(data));

        /* remind: firstBatch and souces are global */
        firstBatch = data;
        sources = _.reduce(data, function(memo, e, i) {

            if(!(e.permaLink && e.source && e.postId))
                return memo;

            var pn = e.permaLink.split('/')[1];

            if(!memo[pn]) {
                memo[pn] = {
                    name: e.source,
                    amount: 1,
                    postIds: [ e.postId ]
                };
            }
            else if( _.size(memo[pn].name) > _.size(e.source) ) {
                memo[pn].name  = e.source;
                memo[pn].amount += 1;
                memo[pn].postIds.push(e.postId);
            } else {
                memo[pn].amount += 1;
                memo[pn].postIds.push(e.postId);
            }

            /* side effect, keep a id-like in the object */
            data[i].idName = pn;

            return memo;
        }, {});

        sources = _.map(sources, function(s, idName) {
            s.idName = idName;
            s.uniquePosts = _.size(_.uniq(s.postIds));
            s.posts = _.size(s.postIds);
            return s;
        });
        console.log("processed", _.size(sources), "unique sources");

        /* Initialize diet section */
        $('#dietSourcesNumber').text(_.size(sources));
        c3.generate({
            bindto: '#dietGraph',
            data: {
                json: sources,
                keys: {
                    x: 'name',
                    value: [ 'posts', 'uniquePosts' ]
                },
                colors: { posts: '#ddec28', uniquePosts: '#3c5a99' },
                type: 'bar',
                names: {
                    posts: 'Posts populate your timeline',
                    uniquePosts: 'Effective posts shared'
                },
                labels: {
                    format: {
                        uniquePosts: function (v, id, i, j) {
                            return sources[i].name;
                        }
                    }
                }
            },
            size: { height: 800 },
            axis: {
                x: {
                    type: 'categories',
                    show: false
                },
                rotated: true,
                y: { show: false }
            },
        });

        /* initialize Raw data section */
        loadHTMLs(pinfo.userId, '#contributionBlock', firstBatch, 0);

        /* initialize CSV section */
        /* initialize knowmore section */
        /* initialize publication section */

        /* finally, render the page requested */
        $(".loader-container").addClass('hidden');
        showandhidesections(sectionName, pinfo.pageName);
    });
};

function loadNextHTMLs(containerId) {
    var pinfo = getURLinfo();
    var url = "/api/v1/htmls/" + pinfo.userId + '/n/' 
        + _.size(firstBatch) + '/' + nextBatch;

    $.getJSON(url, function(collection) {
        var start = _.size(firstBatch);

        loadHTMLs(pinfo.userId, containerId, collection, start);
        firstBatch = _.concat(firstBatch, collection);
        console.log("completed loadNextHTMLs", _.size(collection));
    });
};

function loadHTMLs(userId, containerId, collection, cnt) {
    _.each(collection, function(entry, i) {

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
    var url = "/api/v1/personal/csv/" + pinfo.userId + "/" + type;
    console.log(url);
    window.open(url);
};
