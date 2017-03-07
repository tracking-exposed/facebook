/* This visualization has been recovered just to provide a pretty graph, but the
 * amout of data available in the ß are far stronger than this.  */

//modify focus behaviour in input fields
function setFocus(parent) {
    d3.select("#" + parent).classed("focussed", true);
}

//set transition re-order parameters
var duration = 200,
    delay = function (d,i) {return i * 25;};

function loadRefreshMap(supporterId, containerId) {
    console.log("loadTimelines of", supporterId, "in", containerId);

    /* NOT → number of timelines, NOI →  n.of impressions */
    var NOT = 6; 
    var NOI = 20;

    var url = "/api/v1/refreshmap/" + supporterId + "/" + NOT + "/" + NOI;
    console.log(url);

    return d3.json(url, function(error, data) {
        if (error) return console.error(error);

        //control click behaviour
        var clicked = false;

        d3.select(".toggle-box").classed("showed", true);

        //generate main body and activate toogle-sliders
        var labels = d3.select(containerId)
                        .append("div")
                        .attr("class", "labels");

        var main = d3.select(containerId)
                        .append("div")
                        .attr("class", "main");

        //generate column headers with date and time
        var topContainer = labels
              .selectAll("div.container")
              .data(_.map(data.timelines, 'start'))
              .enter()
              .append("div")
              .attr("class", "container")
              .append("div")
              .attr("class", "timestamp")
              .append("p")
              .text(function(d) {
                  return moment(d).format("DD/MM HH:mm");
              })
              .append("p")
              .append("small")
              .text(function(d) {
                  return moment.duration(moment() - moment(d)).humanize() + ' ago';
              });

        //generate columns with timelines
        var bottomContainer = main.selectAll("div.container")
            .data(data.impressions)
            .enter()
            .append("div")
            .attr("class", "container");

        var timeline = bottomContainer.selectAll("div.posts")
            .data(function(timelines) {
                return _.map(timelines, function(t) {
                    var match  = _.find(data.metadata, { id: t.htmlId });
                    if(match)
                        t.metadata = match;
                    return t;
                });
            })
            .enter()
            .append("div")
            .attr("class", "timeline")
            .attr("data-id", function(d) {
                if(d.metadata && d.metadata.type === 'feed')
                    return d.metadata.permaLink;
                else if(d.metadata && d.metadata.type === 'promoted')
                    return d.metadata.titleId;
                else
                    return d.id;
            })
            .attr("info", function(d) {
                if(d.metadata && d.metadata.type === 'feed')
                    return "🔗 " + d.metadata.permaLink + " ⟬" + d.metadata.hrefType + "⟭";
                else if(d.metadata && d.metadata.type === 'promoted')
                    return d.metadata.title;
                else if (d.visibility === "private")
                    return "friends-only post are excluded from analysis";
                else
                    return "unrecognized entry";
            })
            .style("background-color", function(d) {
                if (d.visibility === "private")
                    return "#eaea5e";
                else if (d.metadata && d.metadata.type === "feed")
                    return "#81e3ea";
                else if (d.metadata && d.metadata.type === "promoted")
                    return "#f76f61";
                else /* these are broken/unparsed posts */
                    return 'lavender';
            })
            .style("cursor", function(d) {
                if(d.metadata && d.metadata.type === 'feed')
                    return "pointer";
                else if(d.metadata && d.metadata.type === 'promoted')
                    return "not-allowed";
            })
            .style("order", function(d) {
                return d.impressionOrder;
            })
            .attr("class", "post-time")
            .text(function(d) {
                if(d.metadata && d.metadata.type === 'feed')
                    return moment(d.metadata.publicationUTime * 1000).format("HH:mm DD ddd");
                else if (d.metadata && d.metadata.type === "promoted")
                    return "Promoted";
                if (d.visibility === "private")
                    return "Friends only";
                else
                    return "Special";
            })
            .on("click", function(d) {
                var dataId = d3.select(this).attr("data-id");
                if(_.startsWith(dataId, '/'))
                    window.open('https://www.facebook.com' + dataId, '_blank');
            })
            .on("mouseover", function(d) {
                var info = d3.select(this).attr("info");
                var dataId = d3.select(this).attr("data-id");

                d3.select("#information")
                    .text(info);
                d3.selectAll(".main .timeline:not([data-id='" + dataId + "'])")
                    .classed("highlight", true);
            })
            .on("mouseout", function(d) {
                d3.selectAll("#information").text("");
            })
            .append("p")
                .attr("class", "post-order")
                .text(function(d) {
                    return d.impressionOrder + "º";
            });
    });
}
