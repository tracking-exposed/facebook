
var linear_tools = function(idTarget) {

  d3.json("/public/stats/2/", function(columnList) {

    var chart = c3.generate({
      bindto: idTarget,
      data: {
        x: 'x',
        xFormat: '%Y-%m-%d',
        columns: columnList
      },
      axis: {
        x: {
          type: 'timeseries',
          localtime: true,
          tick: {
            format: '%Y-%m-%d'
          }
        }
      }
    });
  });
};
