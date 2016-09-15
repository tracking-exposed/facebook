
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
    if(profileId === 0)
        return;
    var url = '/user/public/2/TL/' + profileId + '/0';
    d3.json(url, function(something) {
       appendHTML(containerId, something, url);
    });
};

var displayStatsStyle1 = function(profileId, containerId) {
    if(profileId === 0)
        return;
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
    console.log("dRE");
    var url = '/public/posts/2/';
    d3.json(url, function(something) {
       appendHTML(containerId, something, url);
    });
};

var displayRealityGraph = function(postId, containerId) {
    console.log("dRG");
    if(!postId) return;
    var url = '/public/post/2/' + postId;
    d3.json(url, function(something) {
       appendHTML(containerId, something, url);
    });
};

var cleanFirst = function(containerId) {
    console.log("CF " + containerId);
    var wrtn = document.getElementById(containerId);
    console.log(wrtn);
}

var getPostId = function(sourceMaybe) {
    console.log("gPI");
    if(sourceMaybe === null) {
        console.log(String(document.location));
        var postId = parseInt( (String(document.location))
                                .replace(/.*realitymeter\//, ''));
    } else {
        var writtenv = document.getElementsByClassName(sourceMaybe);
        console.log(writtenv);
        var postId = parseInt("3323");
    }
    if(postId === NaN)
        return null;
    return postId;
}
