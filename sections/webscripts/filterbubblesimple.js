
var appendHTML = function(containerId, something) {
    var svg = d3
        .select(containerId)
        .append("svg")
        .attr("width", "90%");

    var theHtml = [
        '<pre>',
        JSON.stringify(something, undefined, 2),
        '</pre>'
    ].join('');

    svg.append("foreignObject")
        .attr("width", "90%")
        .append("xhtml:body")
        .style("font", "10px 'Helvetica Neue'")
        .html(theHtml);
};

/* that "0" can change based on the "past" version to see ... */
var displayBubbleStyle1= function(profileId, containerId) {
    d3.json('/user/public/2/TL/' + profileId + '/0', function(something) {
       appendHTML(containerId, something); 
    });
};


var displayStatsStyle1 = function(profileId, containerId) {
    d3.json('/user/public/2/ST/' + profileId, function(something) {
       appendHTML(containerId, something); 
    });
};
