function loadStage(postId, postsTable, infocId, graphPcId) {


    console.log("Generated URL " + url);
    if(postId > 1) {
        var url = "/api/v1/realitymeter/" + postId;
        displayRealityGraph(url, graphPcId, infocId);
    }

    var url = "/api/v1/posts/top";
    $.getJSON(url, function(content) {
        var tabbed = _.map(content, function(c, i) {
            var d = moment.duration(moment(c.publicationTime) - moment() ).humanize();

                return [
                    c.updates, 
                    _.size(_.countBy(c.timelines, 'userPseudo')),
                    c.metadata.hrefType,
                    d,
                    _.size(_.countBy(c.timelines, 'geoip')),
                    c.timelines[0].geoip,
                    c.postId
                ];
        });

        console.log(tabbed);
        $(postsTable).DataTable({
            data: tabbed,
            createdRow: function ( row, data, index ) {
                $(row).click(function() {
                    var pid = data[6];
                    $(graphPcId).html("");
                    $(infocId).html("");
                    history.pushState({}, "Post " + pid, "/realitymeter/" + pid);
                    displayRealityGraph("/api/v1/realitymeter/" + pid, graphPcId, infocId);
                });
            }
        });
    });
};

function getPostId() {
    var chunks = document.location.pathname.split('/');
    // ["", "realitymeter", "100009030987674" ]
    var postId = chunks.pop();
    return _.parseInt(postId);
};

var displayRealityGraph = function(url, containerId, infoId) {

    d3.json(url, function(something) {

        var $info = $("<div>", { "class": "infoblock" });
        $info.html(metadata(something));
        $(infoId).append($info);

        console.log(something);
        something.timelines = _.map(something.timelines, function(t) {
            start = moment(t.startTime)
            impression = moment(t.impressionTime)
            t.startTime = start.format("YYYY-MM-DD HH:mm:SS");
            t.impressionTime = impression.format("YYYY-MM-DD HH:mm:SS");
            // console.log( moment.duration(impression - moment(something.publicationTime) ));
            // console.log( moment.duration(moment() - moment(something.publicationTime)).humanize() );
            t.timeago = moment.duration(moment(something.publicationTime) - impression).humanize();
            return t;
        });
        
        var times = _.map({ 'publication': 0, 
                           '5 minutes': 5, 
                           '20 minutes' : 20,
                           '40 minutes': 40,
                           '1 hour': 60,
                           '2 hours':60 * 2,
                           'day quarter': 60 * 6,
                           'a day': 6 * 24,
                           'two days': 2 * 48,
                           '1 week': 2 * 24 * 7
        }, function(minutes, name) {
            return { 
                reftime: moment(something.publicationTime).add(minutes, 'm'),
                name: name
            };
        });


        var tmlns = _.orderBy(something.timelines, 'impressionTime');

        console.log("x");
        _.each(tmlns, function(t) {

            var $div = $("<div>", {id: t.id, "class": "timeline" });
            $div.html(spanWhen(t)+ spanUser(t) + spanOrder(t) );
            $div.click(function(){ console.log("click " + $(this).attr("id")); });
            $(containerId).append($div);

        });
    });
};

function spanWhen(t) {
    var timglip = '<span class="glyphicon glyphicon-time"></span>';
    return '<span class="col-fixed-160 entries when">' +timglip + ' ' + t.timeago + ' after publication </span>';
};

function spanUser(t) {
    // XX
    var userIntro = '<span class="reduced">user pseudonym: </span>';
    return '<span class="col-fixed-160 entries "'+ t.userPseudo + '">' + userIntro + ' ' + t.userPseudo + '</span>';
};

function spanOrder(t) {
    var impressionIntro = '<span class="reduced">feed ranking # </span>';
    return '<span class="col-fixed-160 entries impression">' + impressionIntro + ' ' + t.impressionOrder + '</span>';
};

function metadata(s) {
    return [ '<span>', 'views:', s.updates, 'ദ', 
             'users', _.size(_.countBy(s.timelines, 'userPseudo')),
             'ദ', 'kind:', s.metadata.hrefType, 'ദ',
             s.metadata.permaLink, 'ദ', 'published', 
             moment(s.publicationTime).format("YYYY-MM-DD HH:mm"), ', ',
             moment.duration(moment() - moment(s.publicationTime)).humanize(),
             'ago </span>'].join(' ');
};


var displayRealityGraph_OLD = function(url, containerId, infoId) {

    var maxWidth = window.innerWidth
      || document.documentElement.clientWidth
      || document.body.clientWidth;

    var maxHeight = window.innerHeight
      || document.documentElement.clientHeight
      || document.body.clientHeight;

    var margin = {top: 20, right: 20, bottom: 30, left: 60},
        width = /*960*/ maxWidth - 80 - margin.left - margin.right,
        height = /*500*/ maxHeight -80 - margin.top - margin.bottom,
        /* the space in the 'x' line before the 1st tick & after the last */
        padding = 40;

    /* more the post is in a favorable position, and darker should be */
    var color = d3.scale.linear()
        .domain([1, 30])
        .range(['red', 'blue']);

    var x = d3.scale.ordinal().rangePoints([padding, width - (padding * 2)]);
    var y = d3.time.scale().range([height, 0]);

    var xAxis = d3.svg.axis().scale(x).orient("bottom");
    var yAxis = d3.svg.axis().scale(y).orient("left");

    var svg = d3.select(containerId).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform","translate("+margin.left+","+margin.top+")");

    var parseDate = d3.time.format("%Y-%m-%dT%H:%M:%S.%LZ").parse;

    var line = d3.svg.line()
                     .x(function(d) { return d.x; })
                     .y(function(d) { return d.y; })
                     .interpolate("monotone");

    var threshold = [
        { 'value': 1,
          'visibility': 'max' },
        { 'value': 6,
          'visibility': 'high' },
        { 'value': 10,
          'visibility': 'medium' },
        { 'value': 30,
          'visibility': 'low' }
    ];

    var getLegend = function(order) {
      return _.reduce(threshold, function(level, chk) {
          if(order > chk.value) level = chk.visibility;
          return level;
      }, threshold[0].visibility);
    };

    d3.json(url, function(data) {

        console.log(data);

        var totals = _.countBy(data, function(d) { return d.userPseudo; });

        var stats = _.countBy(
                        _.filter(data, function(d) { return d.presence; }), 
                        function(d) { return d.userPseudo; });

        var firstViz = new Date(
            _.first(_.sortBy(data, 'refreshTime')
        ).refreshTime);

        x.domain(_.map(data, function(d) {
            return d.userPseudo;
        }));

        y.domain(d3.extent(data, function(d) {
            /* side effect, update refreshTime format */
            d.refreshTime = parseDate(d.refreshTime);
            return d.refreshTime;
        })).nice();

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis)
            .append("text")
            .attr("class", "label")
            .attr("x", width)
            .attr("y", -6)
            .style("text-anchor", "end")
            .text("User Pseudonym");

        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
            .append("text")
            .attr("class", "label")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Feed refreshes since " + firstViz.toString() + 
                  ", " + moment.duration(moment() - firstViz).humanize() +
                  " ago"
            );

        /* draw arcs between legend and classed dot */
        _.each(
            _.filter(data, function(d) { return d.presence; }),
            function(d, i) {

              var vizLevel = _.findIndex(threshold, function(t) {
                  return (t.visibility === getLegend(d.order) );
              }) + 1;

              svg.append("path")
                  .attr("class", "visibility-" + getLegend(d.order))
                  .style("stroke", "lightgrey")
                  .style("stroke-width", "1px")
                  .style("fill", "none")
                  .attr("d", line([{
                    x: x(d.userPseudo),
                    y: y(d.refreshTime)
                  }, {
                    x: ( x(d.userPseudo) + (width) ) / 2,
                    y: _.random(20 * vizLevel, 70 * vizLevel)
                  }, {
                    x: width - 18,
                    y: (15 * vizLevel) + (2 * (vizLevel - 1))
                  }]));
            }
        );

        /* draw the line of "timeline without post display" */
        _.each(
            _.filter(data, function(d) { return !d.presence; }),
            function(d, i) {
              svg.append("path")
                  .attr("class", "light-censorship")
                  .style("fill", "yellow")
                  .style("stroke", "pink")
                  .style("stroke-width", "1px")
                  .attr("d", line([{
                    x: x(d.userPseudo) - 12,
                    y: y(d.refreshTime) + 4
                  }, {
                    x: x(d.userPseudo),
                    y: y(d.refreshTime) + 2
                  }, {
                    x: x(d.userPseudo) + 12,
                    y: y(d.refreshTime) - 4
                  }]));
            }
        );

        svg.selectAll(".dot")
            .data(_.filter(data, function(d) { return d.presence; }))
            .enter()
            .append("circle")
            .attr("class", "dot")
            .attr("r", 4)
            .attr("id", function(d, i) {
                return "circle-" + i;
            })
            .attr("class", function(d, i) {
                return "visibility-" + getLegend(d.order);
            })
            .attr("cx", function(d) {
                return x(d.userPseudo);
            })
            .attr("cy", function(d) { return y(d.refreshTime); })
            .style("fill", function(d) {
                return color(d.order);
            })
            .on("mouseenter", function(d, i) {
              d3.select("#circle-" + i).attr("stroke-width", "2px");
              d3.select("#circle-" + i).attr("stroke", "black");
              d3.select(infoId).html(
                  "Position " +
                  d.order +
                  ", user <b>" +
                  d.userPseudo +
                  "</b> with " +
                  totals[d.userPseudo] +
                  " timelines, got display the post " +
                  stats[d.userPseudo] +
                  " times"
              );
            })
            .on("mouseleave", function(d, i) {
              d3.select("#circle-" + i).attr("stroke-width", "0");
            });


        var legend = svg.selectAll(".legend")
            .data(threshold)
            .enter().append("g")
            .attr("class", "legend")
            .attr("id", function(d) {
                return "uniq-" + d.visibility;
            })
            .attr("transform", function(d, i) {
                return "translate(0," + i * 20 + ")";
            });
        legend.append("rect")
            .attr("x", width - 18)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", function(d) {
                return color(d.value);
            });
        legend.append("text")
            .attr("x", width - 24)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .text(function(d) {
                return d.visibility;
            });

    });
};

