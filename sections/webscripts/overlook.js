/* This visualization has been recovered just to provide a pretty graph, but the
 * amout of data available in the ß are far stronger than this.  */

//modify focus behaviour in input fields
function setFocus(parent) {
    d3.select("#" + parent).classed("focussed", true);
}

//set transition re-order parameters
var duration = 200,
    delay = function (d,i) {return i * 25;};

function loadTimelines(supporterId, containerId) {
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

        console.log(data);
        //generate column headers with date and time
        var topContainer = labels.selectAll("div.container")
                                  .data(data.timelines)
                                  .enter()
                                  .append("div")
                                  .attr("class", "container");

        var timestamp = topContainer.append("div")
                                    .attr("class", "timestamp");

        timestamp.append("p")
            .text(function(d) {
                return moment(d.refreshTime).format("DD/MM HH:mm");
            });

        //generate columns with timelines
        var bottomContainer = main.selectAll("div.container")
            .data(data.timelines)
            .enter()
            .append("div")
            .attr("class", "container");

        var timeline = bottomContainer.selectAll("div.posts")
            .data(function(d) {
                console.log(d);
                return d;
            })
            .enter()
            .append("div")
            .attr("class", "timeline")
            .attr("data-id", function(d) {
                if (d.postId === null) {
                    if (d.hasOwnProperty("href")) {
                        var re = /['\n]/g,
                            newRef = d.href.replace(re, " ");
                        var finalRef = newRef.replace(/"\sdata-t.*/, "");
                        return finalRef;
                    }
                } else {
                    return d.postId;
                }
            })
            .style("background-color", function(d) {
                if (d.type === "broken") {
                    return "#414141";
                } else if (d.type === "feed") {
                    return "#81e3ea";
                } else if (d.type === "promoted") {
                    return "#f76f61";
                } else {
                    return "#eaea5e";
                }
            })
            .style("cursor", function(d) {
                if (d.type !== "broken") {
                    return "pointer";
                }
            })
            .style("order", function(d) {
                return d.order;
            })
            .on("click", function(d) {
                clicked = !clicked;
                if (clicked) {
                    if (d.type !== "broken") {
                        var dataId = d3.select(this).attr("data-id");

                        d3.selectAll(".main .timeline:not([data-id='" + dataId + "'])")
                            .classed("fade", true);
                        d3.selectAll(".main .timeline[data-id='" + dataId + "']")
                            .classed("highlight", true);
                    }
                } else {
                    d3.selectAll(".timeline")
                        .classed("fade", false);
                    d3.selectAll(".timeline")
                        .classed("highlight", false);
                }
            })
            .on("mouseover", function(d) {
                if (!clicked) {
                    if (d.type !== "broken") {
                        var dataId = d3.select(this).attr("data-id");

                        d3.selectAll(".main .timeline:not([data-id='" + dataId + "'])")
                            .classed("fade", true);
                        d3.selectAll(".main .timeline[data-id='" + dataId + "']")
                            .classed("highlight", true);
                    }
                }
            })
            .on("mouseout", function(d) {
                if (!clicked) {
                    d3.selectAll(".timeline")
                        .classed("fade", false);
                    d3.selectAll(".timeline")
                        .classed("highlight", false);
                }
            });

        //assign post order and creation time to all the posts
        timeline.append("p")
            .attr("class", "post-order")
            .text(function(d) {
                return d.order + "º";
            });

        timeline.append("div")
            .append("p")
            .attr("class", "post-time")
            .text(function(d) {
                if(d.type === 'promoted')
                    return "Not available";
                return moment(d.creationTime).format("DD/MM HH:mm:ss");
            });

    });
}
