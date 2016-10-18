
//modify focus behaviour in input fields
function setFocus(parent) {
    d3.select("#" + parent).classed("focussed", true);
}

//set transition re-order parameters
var duration = 200,
    delay = function (d,i) {return i * 25;};

function loadTimelines(fbId, containerId) {
    var refNum = d3.select(".refresh-num").property("value");

    var url = "/user/2/timeline/" + fbId + "/0/" + refNum + "/20";
    console.log(url);
    d3.json(url, function(error, data) {
        if (error) return console.error(error);

        //control click behaviour
        var clicked = false;

        //show legend and toggle-slider
        d3.select(".legend-box").classed("showed", true);
        d3.select(".toggle-box").classed("showed", true);

        //generate main body and activate toogle-sliders
        var labels = d3.select(containerId)
                        .append("div")
                        .attr("class", "labels");

        var main = d3.select(containerId)
                        .append("div")
                        .attr("class", "main");

        var typeToggle = d3
          .select(".toggle-sort-type")
          .on("click", function() {
              var btn = d3.select(this);
              var other = d3.select(".toggle-sort-time");

              btn.classed("on", !btn.classed("on"));
              other.classed("on", false);

              d3.selectAll(".main .container")
                  .each(function(d,i) {
                      d3.select(this)
                          .selectAll(".timeline")
                          .sort(function(a,b) {
                              if(btn.classed("on"))
                                  return d3.descending(a.type, b.type);
                              else
                                  return a.order - b.order;
                          })
                          .transition()
                          .duration(duration)
                          .delay(delay)
                          .style("order", function(d,i) {return i});
                  });
            });

        var timeToggle = d3.select(".toggle-sort-time")
          .on("click", function() {
                var btn = d3.select(this);
                var other = d3.select(".toggle-sort-type");

                btn.classed("on", !btn.classed("on"));
                other.classed("on", false);

                d3.selectAll(".main .container")
                  .each(function(d,i) {
                    d3.select(this)
                      .selectAll(".timeline")
                      .sort(function(a,b) {
                        if(btn.classed("on"))
                          return (
                            _.get(b, "creationTime", 
                                new Date(1990, 12)) -
                            _.get(a, "creationTime", 
                                new Date(1990, 12))
                          )
                        else
                          return a.order - b.order;
                      })
                      .transition()
                      .duration(duration)
                      .delay(delay)
                      .style("order", function(d,i) {return i});
                  });
            });

        var infoToggle = d3.select(".toggle-info")
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
