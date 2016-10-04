/*
 * weekly activity and time can be display with:
 * http://figurebelow.com/d3/wp-d3-and-day-hour-heatmap/
 */

var displayPresence = function(userId, containerId) {
    var url = [ '/user/2/analysis/presence', 1000, userId, 'column' ];
    url = url.join('/');
    d3.json(url, function(something) {

        var chart = c3.generate({
            bindto: containerId,
            data: {
              json: something.data,
              keys: {
                x: 'value', 
                value: ['posts seen'],
              }
            },
            axis: {
                x: {
                    label: {
                      text: 'hours ago',
                      position: 'inner-left'
                    },
                    tick: {
                        name: 'value',
                        culling: false
                    }
                }
            },
            grid: {
                 x: {
                    lines: something.lines
                 }
            },
            tooltip: {
                format: {
                    title: function (x) {
                        return moment().subtract(x, 'h').format("H A DD dddd MMMM");
                    }
                }
            }

        });
    });
};

var displayAbsolute = function(userId, containerId) {
    if(userId === 0)
        return;
    var url = [ '/user/2/analysis/absolute', 5000,  userId, 'column' ];
    url = url.join('/');
    d3.json(url, function(something) {
        console.log(something);
        var chart = c3.generate({
            bindto: containerId,
            data: {
              json: something.data,
              keys: {
                x: 'hours', 
                value: ['published posts'],
              }
            },
            axis: {
                x: {
                    label: {
                      text: 'hours ago',
                      position: 'inner-left'
                    },
                    tick: {
                        name: 'value',
                        culling: true
                    }
                }
            },
            grid: {
                 x: {
                    lines: something.lines
                 }
            },
            tooltip: {
                format: {
                    title: function (x) {
                        return moment().subtract(x, 'h').format("H A DD dddd MMMM");
                    }
                }
            },
            legend: {
                show: false
            }
        });
    });
};

