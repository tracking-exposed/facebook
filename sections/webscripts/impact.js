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

	      var content = _.map(x, function(date) {
            var k = _.reduce(something, function(memo, info) {
                var lf = _.find(info.stats, {date: date});
                memo[info.name] = _.isUndefined(lf) ? 0 : lf.count;
                return memo;
            }, {});
            k['x'] = date;
            return k;
        });

        var compromise = _.values(_.reduce(content, function(memo, io) {
            memo['feed'].push(io.feed);
            memo['promoted'].push(io.promoted + 300);
            memo['friendlink'].push(io.friendlink);
            memo['ratio'].push(_.round((io.feed+io.promoted)/io.promoted,2));
            memo['x'].push(io.x);
            return memo;
        }, { 'feed': [ 'feed' ],
              'promoted': [ 'promoted' ],
              'friendlink': [ 'friendlink' ],
              'ratio': [ 'ratio' ],
              'x': [ 'x' ]
        } ));

        var chart = c3.generate({
            bindto: containerId,
            data: {
                x: 'x',
                columns: compromise,
                names: {
                    feed: "Feed posts",
                    promoted: "Promoted posts",
                    friendlink: "Posts display due to friends activities",
                    ratio: "(feed+promoted) / promoted"
                },
                axes: {
                    feed: 'y',
                    promoted: 'y',
                    friendlink: 'y',
                    ratio: 'y2'
                },
                types: {
                    feed: 'bar',
                    promoted: 'bar',
                    friendlink: 'bar',
                    ratio: 'area-spline'
                },
                colors: {
                    feed: '#81e3e1',
                    friendlink: '#eaea5e',
                    promoted: '#f76f61',
                    ratio: '#dfd3de'
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

