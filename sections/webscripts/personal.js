/*
 * weekly activity and time can be display with:
 * http://figurebelow.com/d3/wp-d3-and-day-hour-heatmap/
 */

var displayPresence = function(userId, containerId, postNumb) {
    var url = [ '/user/2/analysis/presence', postNumb, userId, 'c3' ];
    url = url.join('/');
    d3.json(url, function(something) {
        var chart = c3.generate({
            bindto: containerId,
            data: {
                json: something.data,
                keys: {
                    x: 'value',
                    value: ['posts seen'],
                },
                type: 'scatter'
            },
            axis: {
                x: {
                    label: {
                      text: 'hours ago',
                      position: 'inner-left'
                    },
                    tick: {
                        name: 'value',
                        culling: false,
                        fit: true
                    }
                }
            },
            color: {
                pattern: ['#2ca02c', '#aabb00' ]
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

var displayAbsolute = function(userId, containerId, postNumb) {
    if(userId === 0)
        return;
    var url = [ '/user/2/analysis/absolute', postNumb,  userId, 'c3' ];
    url = url.join('/');
    d3.json(url, function(something) {
        var chart = c3.generate({
            bindto: containerId,
            data: {
                json: something.data,
                keys: {
                    x: 'hours',
                    value: ['published posts'],
                },
                type: 'scatter'
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
                        var diff = moment.duration(x, 'h')
                            .humanize();
                        var complete = moment()
                            .subtract(x, 'h')
                            .format("H A DD dddd MMMM");
                        return complete + " (" + diff + " ago)";
                    }
                }
            },
            legend: {
                show: false
            }
        });
    });
};

