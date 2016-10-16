// checks if there are posts in the timeline that could not be parsed and parse date correctly
function fixTimelines(timeline, i, array) {
    var counter = 1,
        j;

    //check the ranking for missing posts
    function findOrder(post) {
        return post.order === counter;
    }

    //return at most 25 posts
    function getTopThirty(post) {
        return post.order <= 25;
    }

    for (j = 0; j < timeline.length; j++) {
        var order = timeline.find(findOrder);
        if (order === undefined) {
            timeline.splice(counter - 1, 0, {
                "order": counter,
                "type": "broken",
                "postId": null
            });
        }
        counter++;
    }
    array[i] = timeline.filter(getTopThirty);
}

//modify focus behaviour in input fields
function setFocus(parent) {
    d3.select("#" + parent).classed("focussed", true);
}

//format time and set transition re-order parameters
var parse = d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ"),
    duration = 200,
    delay = function (d,i) {return i * 25;};

//call API
function loadTimelines() {
    var fbId = d3.select(".fb-id").property("value"),
        refNum = d3.select(".refresh-num").property("value");

    if (fbId === "") {fbId = 797500605}

    //load json
    d3.json("https://crossorigin.me/https://facebook.tracking.exposed/user/2/timeline/" + fbId + "/0/" + refNum + "/30", function(error, data) {
        if (error) return console.error(error);

        //assign correct post order and cut if timelines have more than 25 posts
        data.timelines.forEach(fixTimelines);

        //control click behaviour
        var clicked = false;

        //show legend and toggle-slider
        d3.select(".legend-box").classed("showed", true);
        d3.select(".toggle-box").classed("showed", true);

        //generate main body and activate toogle-sliders
        var labels = d3.select("body")
            .append("div")
            .attr("class", "labels"),

            main = d3.select("body")
            .append("div")
            .attr("class", "main"),

            typeToggle = d3.select(".toggle-sort-type")
                .on("click", function() {
                    var btn = d3.select(this);
                    btn.classed("on", !btn.classed("on"));

                    if (btn.classed("on")) {
                        d3.select(".toggle-sort-time")
                            .classed("on", false);

                        d3.selectAll(".main .container")
                            .each(function(d,i) {
                                d3.select(this)
                                    .selectAll(".timeline")
                                    .sort(function(a,b) {
                                        return d3.descending(a.type, b.type);
                                    })
                                    .transition()
                                    .duration(duration)
                                    .delay(delay)
                                    .style("order", function(d,i) {return i});
                            });
                    } else {
                        d3.selectAll(".main .container")
                            .each(function(d,i) {
                                d3.select(this)
                                    .selectAll(".timeline")
                                    .sort(function(a,b) {
                                        return a.order - b.order;
                                    })
                                    .transition()
                                    .duration(duration)
                                    .delay(delay)
                                    .style("order", function(d,i) {return d.order});
                            });
                    }
                }),

            timeToggle = d3.select(".toggle-sort-time")
                .on("click", function() {
                    var btn = d3.select(this);
                    btn.classed("on", !btn.classed("on"));

                    if (btn.classed("on")) {
                        d3.select(".toggle-sort-type")
                            .classed("on", false);

                        d3.selectAll(".main .container")
                            .each(function(d,i) {
                                d3.select(this)
                                    .selectAll(".timeline")
                                    .sort(function(a,b) {
                                        var firstDate,
                                            secondDate;
                                        if (a.hasOwnProperty("creationTime")) {
                                            firstDate = parse(a.creationTime);
                                        } else {
                                            firstDate = new Date(1990, 12);
                                        }
                                        if (b.hasOwnProperty("creationTime")) {
                                            secondDate = parse(b.creationTime);
                                        } else {
                                            secondDate = new Date(1990, 12);
                                        }
                                        return secondDate - firstDate;
                                    })
                                    .transition()
                                    .duration(duration)
                                    .delay(delay)
                                    .style("order", function(d,i) {return i});
                            });
                    } else {
                        d3.selectAll(".main .container")
                            .each(function(d,i) {
                                d3.select(this)
                                    .selectAll(".timeline")
                                    .sort(function(a,b) {
                                        return a.order - b.order;
                                    })
                                    .transition()
                                    .duration(duration)
                                    .delay(delay)
                                    .style("order", function(d,i) {return d.order});
                            });
                    }
                }),

            infoToggle = d3.select(".toggle-info")
                .on("click", function() {
                    var btn = d3.select(this),
                        container = d3.select(".main");

                    btn.classed("on", !btn.classed("on"));
                    container.classed("on", !container.classed("on"));
                });

        //generate column headers with date and time
        var topContainer = labels.selectAll("div.container")
            .data(data.refreshes)
            .enter()
            .append("div")
            .attr("class", "container"),

            timestamp = topContainer.append("div")
            .attr("class", "timestamp");

        timestamp.append("p")
            .text(function(d, i) {
                var formatDate = d3.timeFormat("%e %b %Y"),
                    date = formatDate(parse(d.refreshTime));
                return date;
            });

        timestamp.append("p")
            .text(function(d, i) {
                var formatTime = d3.timeFormat("%H:%M"),
                    time = formatTime(parse(d.refreshTime));
                return time;
            });

        //generate columns with timelines
        var bottomContainer = main.selectAll("div.container")
            .data(data.timelines)
            .enter()
            .append("div")
            .attr("class", "container"),

            timeline = bottomContainer.selectAll("div.posts")
            .data(function(d) {
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
                if (d.hasOwnProperty("creationTime")) {
                    var formatTime = d3.timeFormat("%H:%M"),
                        time = formatTime(parse(d.creationTime)),
                        formatDate = d3.timeFormat("%e %b '%y"),
                        date = formatDate(parse(d.creationTime));
                    return date + ", " + time;
                }
            });

    });
}

//make API call when button is clicked
d3.select(".intro-btn")
    .on("click", loadTimelines);
