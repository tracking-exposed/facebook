
var displayRealityGraph = function(postId, containerId) {
    console.log("displayRealityGraph of postId " + postId);
    if(!postId || postId === "0") return;
    var url = '/post/reality/2/' + postId;

    var margin = {top: 20, right: 20, bottom: 30, left: 40},
        width = 960 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

    /* more the post is in a favorable position, and darker should be */
    var color = d3.scale.linear()
        .domain([30, 0])
        .range(["palegreen", "steelblue"]);

    var x = d3.scale.ordinal(['a', 'b', 'c']).range([0, width]);
    var y = d3.time.scale().range([height, 0]);

    var xAxis = d3.svg.axis().scale(x).orient("bottom");
    var yAxis = d3.svg.axis().scale(y).orient("left");

    var svg = d3.select(containerId).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform","translate("+margin.left+","+margin.top+")");

    var parseDate = d3.time.format("%Y-%m-%dT%H:%M:%S.%LZ").parse;

    d3.json(url, function(data) {
        console.log(data);

        data.forEach(function(d, i) {
            d.refreshTime = parseDate(d.refreshTime);
        });
/*
        x.domain(d3.extent(data, function(d) {
            return d.userId;
        })).nice();
*/
        y.domain(d3.extent(data, function(d) {
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
            .text("Sepal Width (cm)");

        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
            .append("text")
            .attr("class", "label")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Sepal Length (cm)");

        svg.selectAll(".dot")
            .data(data)
            .enter().append("circle")
            .attr("class", "dot")
            .attr("r", 3.5)
            .attr("cx", function(d) { 
                if(d.presence)
                    return x('a');
                else
                    return x('b');
            })
            .attr("cy", function(d) { return y(d.refreshTime); })
            .style("fill", function(d) {
                if(d.presence)
                    return color(d.order);
                else
                    return color(30);
            });

        var legend = svg.selectAll(".legend")
            .data(color.domain())
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", function(d, i) {
                return "translate(0," + i * 20 + ")";
            });

        legend.append("rect")
            .attr("x", width - 18)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", color);

        legend.append("text")
            .attr("x", width - 24)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .text(function(d) { return d; });
    });
};

/* not working at the moment the 'click' trapping of button ? */
var getPostId = function(formId) {
    var writtenv = document.getElementById(formId);
    console.log(writtenv);
    var postId = parseInt("3323");

    if(postId === NaN)
        return null;
    console.log("parsed " + postId);
    return postId;
};
