
var appendHTML = function(containerId, something, url) {
    var svg = d3
        .select(containerId)
        .append("svg")
        .attr("width", "90%")
        .attr("height", 600);

    var theHtml = [
        '<i>',
        url,
        '</i>',
        '<pre>',
        JSON.stringify(something, undefined, 2),
        '</pre>'
    ].join('');

    svg.append("foreignObject")
        .attr("width", "90%")
        .attr("height", 600)
        .attr("background", "#002211")
        .append("xhtml:body")
        .style("font", "10px 'Helvetica Neue'")
        .html(theHtml);
};

/* that "0" can change based on the "past" version to see ... */
var displayBubbleStyle1= function(profileId, containerId) {
    var url = '/user/public/2/TL/' + profileId + '/0';
    d3.json(url, function(something) {
       appendHTML(containerId, something, url);
    });
};

var displayStatsStyle1 = function(profileId, containerId) {
    var url = '/user/public/2/ST/' + profileId;
    d3.json(url, function(something) {
       appendHTML(containerId, something, url);
    });
};

var displayOverseer = function(containerId) {
    var url = '/admin/view/2/';
    d3.json(url, function(something) {
       appendHTML(containerId, something, url);
    });
};

var displayRealityExamples = function(containerId) {
    var url = '/public/posts/2/';
    d3.json(url, function(something) {
       appendHTML(containerId, something, url);
    });
};
