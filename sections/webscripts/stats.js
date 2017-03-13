function aggregateTime(smallchunks, timeattr, amount, unit) {
    /* 1st: result of .hourlyIO
     * 2nd: 'start', or 'savingTime'
     * 3rd & 4th, amount/unit for moment().add().subtract */

    /* here can be partinioned if we want only small part */
    var y = _.orderBy(smallchunks, timeattr);
    var first = _.get(_.first(y), timeattr);
    var last = _.get(_.last(y), timeattr);

    var retv = [];
    var momentz = _.map(y, function(e) {
        return _.set(e, timeattr, moment(_.get(e, timeattr)));
    });

    _.reduce(momentz, function(memo, entry, order) {
        /* Taking the first is good only because we've a periodic
         * list of entries,
         * If you've a hole of some days, this will be a bug */
        var comparison = _.get(memo[0], timeattr);
        if(!comparison)
            return [];
        comparison.add(amount, unit);

        /* split between the object in the window and the others */
        var part = _.partition(memo, function(e) {
            return comparison.isAfter(_.get(e, timeattr));
        });

        var generated = _.reduce(part[0], function(m, e) {
            _.each(e, function(value, key) {
                /* necessary check or we sum the seconds!, && value to skip 0s */
                if(key !== timeattr && value)
                    m[key] = m[key] > 0 ? m[key] + value : value;
            });
            return m;
        }, {});

        /* put .start or `timeattr` in the object */
        if(_.size(part[0])) {
            _.set(generated, timeattr, _.get(part[0][0], timeattr).format("YYYY-MM-DD HH:mm:SS"));
            /* the generated object is add as side effect */
            retv.push(generated);
        }

        /* return only the object still unprocessed */
        return part[1];
    }, momentz);

    return retv;
};

function fillUsersGraphs(activitiesContainer, userContainer) {

    var url = '/api/v1/stats/basic';

    d3.json(url, function(something) {

        var activities = _.map(something, function(e) {
            return _.pick(e, ['htmls', 'impressions', 'timelines', 'start']);
        });

        /* 
         * The "total" can't work in this way here, has to be done 
         * after the time aggregation -- still, is something to take back 
         *
        var users = _.reduce(something, function(memo, e) {
            var o = _.pick(e, ['visits', 'newsupporters', 'start']);

            memo.counters.supporters += o.newsupporters;
            memo.counters.evidences += o.htmls;

            o.supporters = memo.counters.supporters;
            o.evidences = memo.counters.evidences;

            memo.accumulated.push(o);
            return memo;

        }, { accumulated: [], counters: { supporters: 0, evidences: 0 }}).accumulated;
          */

        var users = _.map(something, function(e) {
            return _.pick(e, ['visits', 'newsupporters', 'start']);
        });

        c3.generate({
            bindto: activitiesContainer,
            data: {
                json: aggregateTime(activities, 'start', 1, 'd'),
                keys: {
                    x: 'start',
                    value: [ "htmls", "impressions", "timelines" ]
                },
                xFormat: '%Y-%m-%d %H:%M:%S',
                types: {
                    'impressions': 'area',
                    'timelines': 'line',
                    'htmls': 'area'
                },
                axes: {
                    'timelines': 'y2',
                    'htmls': 'y',
                    'impressions': 'y'
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
                    label: 'Informative objects'
                }
            },
            point: {
                r: 1
            }
        });

        c3.generate({
            bindto: userContainer,
            data: {
                json: aggregateTime(users, 'start', 12, 'h'),
                keys: {
                    x: 'start',
                    value: [ "newsupporters", "visits" ]
                },
                xFormat: '%Y-%m-%d %H:%M:%S',
                types: {
                    'newsupporters': 'bar',
                    'visits': 'line'
                },
                axes: {
                    'visits': 'y2',
                    'newsupporters': 'y',
                },
                colors: {
                    newsupporters: 'rgb(227, 119, 194)',
                    visits : 'darkblue'
                }
            },
            axis: {
                x: {
                    type: 'timeseries',
                    tick: {
                        format: '%Y-%m-%d %H:%M'
                    } 
                },
                y2: {
                    show: true,
                    label: 'Visits'
                },
                y: {
                    label: 'New Supporters'
                }
            },
            point: {
                r: 1
            }
        });
    });
};

function fillMetadataGraph(containerId) {

    var url = '/api/v1/stats/metadata';

    d3.json(url, function(something) {

        c3.generate({
            bindto: containerId,
            data: {
                json: aggregateTime(something, 'start', 2, 'd'),
                keys: {
                    x: 'start',
                    value: [ "feed", "photo", "post", "postId", "promoted", "video" ]
                },
                xFormat: '%Y-%m-%d %H:%M:%S',
                type: 'spline',
                axes: {
                    'promoted': 'y2',
                    'feed': 'y2',
                    'postId': 'y2',
                    'photo': 'y',
                    'video': 'y',
                    'post': 'y',
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
                    label: 'Posts by intrinsical reasons'
                },
                y: {
                    label: 'Kinds of UGC'
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

