
var displayBubbleStyle1= function(profileId, containerId) {
    /* this function run in the browser and render the output
     * of http://$HOST/user/public/2/TL/:profileId */

    console.log("XXX " + profileId + " calling ");
    d3.json('/user/public/2/TL/' + profileId + '/0', function(something) {

        console.log("timeLine");
        console.log(something);
    });
};


var displayStatsStyle1 = function(profileId, containerId) {

    d3.json('/user/public/2/ST/' + profileId, function(something) {

      var svg = d3
          .select(containerId)
          .append("svg")
          .attr("width", 960)
          .attr("height", 500);

      var theHtml = [
          '<span>',
              'Refreshes: ',
              something.refreshNumber,
          '</span>',
          '<span>',
              'post seen: ',
              something.postSeen,
          '</span>'
      ].join('');

      svg.append("foreignObject")
          .attr("width", 480)
          .attr("height", 500)
          .append("xhtml:body")
          .style("font", "14px 'Helvetica Neue'")
          .html(theHtml);

    });
};
