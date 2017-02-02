
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
            y2: { show: true }
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
        }
    });
};

function renderMetadata(something, containerId) {
    return c3.generate({
        bindto: containerId,
        data: {
            json: something,
            keys: {
                x: 'date',
                value: [ 'promoted', 'unexpected', 'feed', 'scanned', 'promotedpages', 'promotedowners' ]
            },
            names: {
                'promoted': "Promoted content",
                'feed': "Friend's Feed",
                'scanned': "Analyzed so far",
                'promotedpages': "Pages detected",
                'promotedowners': "Owners detected",
                'unexpected': "unrecognized HTML"
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
}


var kindMap = {
    'impressions': [ 'daily/impressions', renderImpression ],
    'users': [ 'daily/users', renderUsers ],
    'metadata': [ 'daily/metadata', renderMetadata ]
};

function byDay(kind, containerId) {

    if( _.size(kindMap[kind]) !== 2 ) {
        console.log("not yet supported", kind);
        return;
    }

    var url = '/api/v1/' + _.nth(kindMap[kind], 0);
    var renderF = _.nth(kindMap[kind], 1);

    console.log("Fetching for", kind, "in", url);
    d3.json(url, function(something) {
        var chart = renderF(something, containerId);
        /* eventually, we can manage updates of this chart */
    });

}


var displayCountryPie = function(containerId) {
    var url = '/api/v1/node/countries/c3';
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

