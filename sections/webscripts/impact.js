var displayTimeAdoption = function(containerId) {
    var url = '/node/activity/2/c3';
    d3.json(url, function(something) {

        console.log("displayTimeAdoption");
        console.log(something);

        var chart = c3.generate({
            bindto: containerId,
            data: {
                x: 'x',
                columns: something,
                names: {
                    timeline: "Posts recorded",
                    refreshes: "Feed refreshes",
                    supporters: "Users not coming back",
                    users: "Users submitting data"
                },
                axes: {
                    timeline: 'y',
                    refreshes: 'y',
                    supporters: 'y2',
                    users: 'y2'
                },
                types: {
                    timeline: 'line',
                    refreshes: 'area',
                    supporters: 'bar',
                    users: 'spline'
                },
                labels: true,
                colors: {
                    timeline: '#afa3ae',
                    refreshes: '#8b9dc3',
                    supporters: '#ff6961',
                    users: '#3b5998'
                }
            },
            axis: {
                x: {
                    type: 'timeseries',
                    tick: {
                        format: '%Y-%m-%d'
                    }
                },
                y2: { show: true }
            }
        });
    });
};

var displayCountryPie = function(containerId) {
    var url = '/node/countries/2/column';
    d3.json(url, function(something) {
        console.log(something);

        var chart = c3.generate({
            bindto: containerId,
            data: {
              type : 'pie',
              labels: true,
              columns: something
            }
        });
    });
};

var displayPostType = function(containerId) {
    var url = '/node/posttype/2/json';
    d3.json(url, function(something) {
        console.log("displayPostType");
        console.log(something);

        var x = _.uniq(_.reduce(something, function(memo, info) {
            return _.concat(memo, _.map(info.stats, function(e) {
                return e.date;
            }));
        }, []));
        console.log("X");
        console.log(x);

	      var content = _.map(x, function(date) {
            var k = _.reduce(something, function(memo, info) {
                var lf = _.find(info.stats, {date: date});
                memo[info.name] = _.isInteger(lf.count) ? lf.count : 0;
                return memo;
            }, {});
            k['x'] = date;
            return k;
        });
        console.log("cnt");
        console.log(content);

        var compromise = _.values(_.reduce(content, function(memo, io) {
            memo['feed'].push(io.feed);
            memo['promoted'].push(io.promoted);
            memo['friendlink'].push(io.friendlink);
            memo['x'].push(io.x);
            return memo;
        }, { 'feed': [ 'feed' ],
              'promoted': [ 'promoted' ],
              'friendlink': [ 'friendlink' ],
              'x': [ 'x' ]
        } ));

        console.log("comp");
        console.log(compromise);

        var chart = c3.generate({
            bindto: containerId,
            data: {
                x: 'x',
                columns: compromise,
                names: {
                    feed: "Feed posts",
                    promoted: "Promoted posts",
                    friendlink: "Posts display due to friends activities"
                },
                axes: {
                    feed: 'y',
                    promoted: 'y',
                    friendlink: 'y'
                },
                types: {
                    feed: 'line',
                    promoted: 'line',
                    friendlink: 'line'
                },
                labels: true,
                colors: {
                    feed: '#81e3e1',
                    friendlink: '#eaea5e',
                    promoted: '#f76f61'
                }
            },
            axis: {
                x: {
                    type: 'timeseries',
                    tick: {
                        format: '%Y-%m-%d'
                    }
                }
            }
        });
    });
};

