function aggregateTime(hourlychunks, timeattr, amount, unit) {
    /* 1st: result of .hourlyIO
     * 2nd: 'start', or 'savingTime'
     * 3rd & 4th, amount/unit for moment().add().subtract */

    /* here can be partinioned if we want only small part */
    var y = _.orderBy(hourlychunks, timeattr);
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

function c3statsGenerate(blob) {

    blob.data.xFormat = '%Y-%m-%d %H:%M:%S';
    blob.data.keys.x = 'start';
    blob.axis.x = {
        type: 'timeseries', tick: { format: '%d-%m %H:00' }
    };
    blob.point = { r: 1 };

    c3.generate(blob);
};

function fillUsersGraphs(activitiesContainer, userContainer) {

    var url = '/api/v1/stats/basic/2';

    d3.json(url, function(something) {

        var last2w = _.filter(something, function(e) {
            return moment(e.start).isAfter(moment().subtract(2, 'w'));
        });

        /* country analysis is based on the last two weeks only */
        var contributors = [];
        var ccc = _.map(last2w, function(e) {
            return _.reduce(e.timelinecc, function(memo, amount, cc) {
                memo[cc] = amount;
                var f = _.find(contributors, { nation: cc});
                if(!f)
                    contributors.push({ nation: cc, amount: amount});
                else
                    f.amount += amount;
                return memo;
            }, _.set({}, 'start', e['start']));
        });
        contributors = _.reverse(
            _.orderBy(_.filter(contributors, function(c) {
                return c.amount > 200;
        }), 'amount'));

        c3statsGenerate({
            bindto: '#contribcountries',
            data: {
                json: aggregateTime(ccc, 'start', 4, 'h'),
                keys: {
                    value: _.map(contributors, 'nation')
                },
                type: 'spline',
                labels: true
            },
            axis: {
                y: { label: 'Timelines by Country' }
            }
        });

        /* views viz */
        var visitors = [];
        var vcc = _.map(last2w, function(e) {
            return _.reduce(e.visitcc, function(memo, amount, cc) {
                memo[cc] = amount;
                var f = _.find(visitors, { nation: cc});
                if(!f)
                    visitors.push({ nation: cc, amount: amount});
                else
                    f.amount += amount;
                return memo;
            }, _.set({}, 'start', e['start']));
        });
        visitors = _.reverse(
            _.orderBy(_.filter(visitors, function(c) {
                return c.amount > 50;
        }), 'amount'));

        c3statsGenerate({
            bindto: '#viewscountries',
            data: {
                json: aggregateTime(vcc, 'start', 4, 'h'),
                keys: {
                    value: _.map(visitors, 'nation')
                },
                type: 'spline',
                labels: true
            },
            axis: {
                y: { label: 'Views by Country' }
            }
        });


        var activities = _.map(something, function(e) {
            return _.pick(e, ['htmls', 'impressions', 'timelines', 'start']);
        });

        c3statsGenerate({
            bindto: activitiesContainer,
            data: {
                json: aggregateTime(activities, 'start', 1, 'd'),
                keys: {
                    value: [ "htmls", "impressions", "timelines" ]
                },
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
                y2: {
                    show: true,
                    label: 'Timelines'
                },
                y: { label: 'Informative objects' }
            }
        });

        var users = _.map(something, function(e) {
            return _.pick(e, ['visits', 'newsupporters', 'start']);
        });

        c3statsGenerate({
            bindto: userContainer,
            data: {
                json: aggregateTime(users, 'start', 12, 'h'),
                keys: {
                    value: [ "newsupporters", "visits" ]
                },
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
                y2: {
                    show: true,
                    label: 'Visits'
                },
                y: { label: 'New Supporters' }
            }
        });
    });
};

function fillMetadataGraph(containerId) {

    var url = '/api/v1/stats/metadata/2';

    d3.json(url, function(something) {

        var last2w = _.filter(something, function(e) {
            return moment(e.start).isAfter(moment().subtract(2, 'w'));
        });

        c3statsGenerate({
            bindto: containerId,
            data: {
                json: aggregateTime(last2w, 'start', 6, 'h'),
                keys: {
                    value: [ "photo", "video", "post",
                             "feed", "postId", "promoted" ]
                },
                axes: {
                    'photo': 'y2',
                    'video': 'y2',
                    'post': 'y2',
                    'feed': 'y',
                    'postId': 'y',
                    'promoted': 'y',
                },
                type: 'line',
                types: {
                    photo: 'bar',
                    video: 'bar',
                    post: 'bar',
                },
                groups: [ [ 'photo', 'video', 'post' ] ],
                colors: {
                    photo: 'rgba(243, 208, 19, 0.87)',
                    video: 'rgba(238, 15, 26, 0.68)',
                    post: 'rgba(51, 234, 33, 0.78)'
                }
            },
            axis: {
                y2: {
                    show: true,
                    label: 'Kind of feed posts'
                },
                y: { label: 'Kinds of Impressions' }
            },
            tooltip: {
                grouped: false
            },
        });
    });
};
