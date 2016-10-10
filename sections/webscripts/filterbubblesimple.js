
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
var displayFluctuation = function(userId, containerId) {
    if(userId === 0)
        return;
    var url = '/user/public/2/distortion/' + userId + '/column';
    d3.json(url, function(something) {
        console.log(url);
        console.log(something);
    });
};

var cleanFirst = function(containerId) {
    console.log("CF " + containerId);
    var wrtn = document.getElementById(containerId);
    console.log(wrtn);
}
