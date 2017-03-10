function aggregateTime(smallchunks, timeattr, amount, unit) {
    /* 1st: result of .hourlyIO
     * 2nd: '.start', or '.savingTime' ...
     * 3rd: a number of...
     * 4th: 'd', 'w', 'm', 'h' ...          */

    /* here can be partinioned if we want only small part */
    var y = _.orderBy(smallchunks, timeattr);
    var first = _.get(_.first(y), timeattr);
    var last = _.get(_.last(y), timeattr);

    var retv = [];
    var momentz = _.map(y, function(e) {
        return _.set(e, timeattr, moment(_.get(e, timeattr)));
    });

    var x = _.reduce(momentz, function(memo, entry, order) {
        var comparison = _.get(memo[0], timeattr);
        comparison.add(amount, unit);

        var part = _.partition(memo, function(e) {
            return comparison.isAfter(_.get(e, timeattr));
        });
        var generated = _.reduce(part[0], function(m, e) {
            _.each(e, function(value, key) {
                if(key !== timeattr)
                    m[key] = m[key] > 0 ? m[key] + value : value;
            });
            return m;
        }, {});

        if(_.size(part[0])) {
            _.set(generated, timeattr, _.get(part[0][0], timeattr).format("YYYY-MM-DD HH:mm:SS"));
            /* the generated object is add as side effect */
            retv.push(generated);
        }

        return part[1]
    }, momentz);

    return retv;
};

function fillUsersGraphs(activitiesContainer, userContainer) {

    var url = '/api/v1/stats/basic';

};

function fillMetadataGraph(containerId) {

    var url = '/api/v1/stats/metadata';

    d3.json(url, function(something) {

        return c3.generate({
            bindto: containerId,
            data: {
                json: aggregateTime(something, 'start', 2, 'd'),
                keys: {
                    x: 'start',
                    value: [ "feed", "photo", "post", "postId", "promoted", "video" ]
                },
                xFormat: '%Y-%m-%d %H:%M:%S',
                type: 'spline',
                /* ,
                names: {
                    'promoted': "Promoted content",
                    'feed': "Friend's Feed",
                    'scanned': "Analyzed so far",
                    'promotedpages': "Pages detected",
                    'promotedowners': "Owners detected",
                    'unexpected': "unrecognized HTML"
                } */
            },
            axis: {
                x: {
                    type: 'timeseries',
                    tick: {
                        format: '%Y-%m-%d'
                    } 
                },
                y2: {
                    show: true,
                    label: 'Posts basic kind'
                },
                y: {
                    label: 'Kind of UGC seen'
                }
            },
            point: {
                r: 1
            }
        });
    });
};


function renderImpression(something, containerId) {
    return c3.generate({
        bindto: containerId,
        data: {
            json: something,
            keys: {
                x: 'date',
                value: ['htmls','impressions','timelines']
            },
            axes: {
                htmls: 'y',
                impressions: 'y',
                timelines: 'y2'
            },
            types: {
                htmls: 'line',
                impressions: 'line',
                timelines: 'area'
            },
            colors: {
                timelines: '#f0e971'
            }
        },
        axis: {
            x: {
                type: 'timeseries',
                tick: {
                    format: '%Y-%m-%d'
                }
            },
            y2: {
                show: true,
                label: 'Timelines'
            },
            y: {
                label: 'Posts'
            }
        },
        point: {
            r: 1
        }
    });
};

function renderUsers(something, containerId) {
    return c3.generate({
        bindto: containerId,
        data: {
            json: something,
            keys: {
                x: 'date',
                value: [ "activeusers", "newusers", "notcomingback", "pageviews" ]
            },
            names: {
                activeusers: "Active Users",
                newusers: "new Supporters",
                // At this momnet I'm not successfully saving this data,
                // has to be fixed ASAP 
                notcomingback: "Supporters not coming back",
                pageviews: "Page views"
            },
            axes: {
                activeusers: 'y',
                newusers: 'y',
                notcomingback: 'y',
                pageviews: 'y2'
            },
            types: {
                activeusers: 'line',
                newusers: 'bar',
                notcomingback: 'bar',
                pageviews: 'area'
            },
            colors: {
                activeusers: 'rgb(227, 119, 194)',
                newusers: 'rgb(188, 189, 34)',
                notcomingback: 'rgb(214, 39, 40)',
                pageviews:'#d4d7d0'
            }
        },
        axis: {
            x: {
                type: 'timeseries',
                tick: {
                    format: '%Y-%m-%d'
                }
            },
            y2: { 'show': true }
        },
        point: {
            r: 1
        }
    });
};

