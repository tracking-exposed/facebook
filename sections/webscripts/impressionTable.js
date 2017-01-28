function loadTimelines(userId, containerId, detailsContainer, detailDesc) {
    var url = '/api/v1/timelines/' + userId;

    $.getJSON(url, function(collections) {

        /* convert collections with basic shape explained here 
         * https://datatables.net/manual/data/ */
        var converted = _.map(collections, function(list) {
            return [
                moment(list.startTime).format("YYYY-MM-DD"),
                list.when,
                list.duration,
                list.visible,
                list.total,
                list.timelineId
            ];
        });

        $(containerId).DataTable( {
            data: converted,
            "createdRow": function ( row, data, index ) {
                $(row).click(function() {
                    renderTimeline(detailsContainer, detailDesc, data[5]);
                });
            } 
        });
    });
};

function fillmetablob(containerId, entry) {
    $('<pre>' + 
        JSON.stringify(entry, undefined, 2) + 
      '</pre>').appendTo(containerId);
};

function renderTimeline(containerId, detailDesc, timelineId) {
    var url = '/api/v1/metadata/' + timelineId;

    $(detailDesc).text("Showing content from " + url);
    $(containerId).empty();
    $.getJSON(url, function(collections) {
        _.each(collections, function(metaentry) {
            fillmetablob(containerId, metaentry);
        });
    });
};

/* ----------------------- */

function loadContribution(userId, containerId) {
    var url = "/api/v1/personal/contribution/" + userId + '/0/10';
    console.log(url);
    /* DaysAgo timeline impressions htmls */
    $.getJSON(url, function(collections) {
        /* convert collections with basic shape explained here 
         * https://datatables.net/manual/data/ */
        var converted = _.map(collections, function(infob) {
            return _.values(infob)
        });
        console.log(converted[0]);
        $(containerId).DataTable( {
            data: converted
        });
    });
};

function loadPromoted(userId, containerId) {
    var url = "/api/v1/personal/promoted/" + userId + '/0/10';
    console.log(url);

    /* When Owner MediaType PromotedLink */
    $.getJSON(url, function(collections) {
        /* convert collections with basic shape explained here 
         * https://datatables.net/manual/data/ */
        console.log(collections);
        var converted = _.map(collections, function(o) {
            return [ o.daysago, o.ownerName, o.promotedMedia, o.promotedPage ];
        });
        console.log(converted[0]);
        $(containerId).DataTable( {
            data: converted
        });
    });
};

function loadHeatmap(userId, recentC, olderC) {
    var url = "/api/v1/personal/heatmap/" + userId;

    /* you can ask for a time window from the API */
    var recentUrl = "/api/v1/personal/heatmap/" + userId + "/0/1";
    var olderUrl = "/api/v1/personal/heatmap/" + userId + "/2/20";

    var recent = new CalHeatMap();
    recent.init({
        itemSelector: recentC,
        data: recentUrl,
        legendColors: {
            min: "#efefef",
            max: "steelblue",
            empty: "white"
        },
        verticalOrientation: true,
        displayLegend: false,
        cellSize: 25,
        domainGutter: 2,
        label: { position: 'top' },
        range: 2,
        start: new Date(moment().subtract(1,'d')),
        domain: "day",
        subDomain: "hour"
    });

    var older = new CalHeatMap();
    older.init({
        itemSelector: olderC,
        data: olderUrl,
        start: new Date(moment().subtract(20, 'd')),
        range: 20,
        domain: "day",
        subDomain: "hour"
    });
};
