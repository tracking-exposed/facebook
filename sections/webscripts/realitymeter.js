
var displayRealityGraph = function(postId, containerId) {
    if(!postId || postId === "0") return;
    var url = '/post/reality/2/' + postId;

    var margin = {top: 20, right: 20, bottom: 30, left: 60},
        width = 960 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom,
        /* the space in the 'x' line before the 1st tick & after the last */
        padding = 40;

    /* more the post is in a favorable position, and darker should be */
    var color = d3.scale.linear()
        .domain([1, 30])
        .range(['yellow', 'darkgreen']);

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

    d3.json(url, function(data) {

        var stats = _.countBy(data, function(d) {
            return d.presence ? d.userPseudo + "Y" : d.userPseudo + "N";
        }, []);
        var firstViz = new Date(_.last(_.sortBy(data, 'refreshTime')).refreshTime);

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
            .text("User ID");

        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
            .append("text")
            .attr("class", "label")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Display after " + firstViz.toLocaleString() );

        svg.selectAll(".dot")
            .data(_.filter(data, function(d) { return d.presence; }))
            .enter()
            .append("circle")
            .attr("class", "dot")
            .attr("r", 4)
            .attr("cx", function(d) {
                return x(d.userPseudo);
            })
            .attr("cy", function(d) { return y(d.refreshTime); })
            .style("stroke", function(d) {
                return color(d.order + 10);
            })
            .style("fill", function(d) {
                return color(d.order);
            });
/*
        svg.selectAll(".rect")
            .data(_.filter(data, function(d) { return !d.presence; }))
            .enter()
            .append("rect")
            .attr("class", "rect")
            .attr("x", function(d) {
                return x(d.userPseudo) - 4;
            })
            .attr("y", function(d) {
                return y(d.refreshTime) + 4;
            })
            .attr("width", 8)
            .attr("height", 8)
            .style("fill", function(d) {
                return color(d.order);
            });
*/

        _.each(
            _.filter(data, function(d) { return !d.presence; }),
            function(d) {
              svg.append("path")
                  .attr("class", "line")
                  .style("stroke", 'grey')
                  .attr("d", line([{
                    x: x(d.userPseudo),
                    y: y(d.refreshTime)
                  }, {
                    x: x(d.userPseudo) + 6,
                    y: y(d.refreshTime) - 2
                  }]));
            }
        );

        var legend = svg.selectAll(".legend")
            .data([
                { 'value': 1,
                  'visibility': 'max' },
                { 'value': 10,
                  'visibility': 'high' },
                { 'value': 20,
                  'visibility': 'medium' },
                { 'value': 30,
                  'visibility': 'low' }
            ])
            .enter().append("g")
            .attr("class", "legend")
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

/* not working at the moment the 'click' trapping of button ? */
var getPostId = function(formId) {
    var writtenv = document.getElementById(formId).value;
    var postId = _.parseInt(writenv);

    if(postId === NaN)
        return null;
    return postId;
};
