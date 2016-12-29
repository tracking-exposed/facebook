/*
var displayTimeAdoption = function(containerId) {
    d3.json(url, function(something) {

        var chart = c3.generate({
            bindto: containerId,
            data: {
                x: 'x',
                json: something,
                names: {
                    'supporters': 'Users during time',
                    'timelines': 'Timelines',
                    'impressions': 'Number of posts seen',
                    'htmls': 'Public post along HTML snippet',
                    'accesses': 'access to the static pages'
                },
                axes: {
                    supporters: 'y',
                    timelines: 'y',
                    impressions: 'y2',
                    htmls: 'y2',
                    accesses: 'y'
                },
                types: {
                    supporters: 'line',
                    timelines: 'line',
                    impressions: 'line',
                    htmls: 'line',
                    accesses: 'line'
                },
                labels: true,
                colors: {
                    impressions: '#afa3ae',
                    timelines: '#f06961',
                    supporters: '#0f6961',
                    accesses: '#344944',
                    htmls: '#a459e8'
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
*/

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
                notcomingback: "Supporters not coming back",
                pageviews: "Page views"
            },
            axes: {
                activeusers: 'y',
                newusers: 'y',
                notcomingback: 'y',
                pageviews: 'y'
            },
            types: {
                activeusers: 'line',
                newusers: 'line',
                notcomingback: 'line',
                pageviews: 'line'
            },
            colors: {
                activeusers: '#424242',
                newusers: '#727272',
                notcomingback: '#a200a2',
                pageviews:'#f47700' 
            }
        },
        axis: {
            x: {
                type: 'timeseries',
                tick: {
                    format: '%Y-%m-%d'
                }
            },
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
                value: [ 'ws' ]
            },
            names: {
                activeusers: "Active Users",
                newusers: "new Supporters",
                notcomingback: "Supporters not coming back",
                pageviews: "Page views"
            },
            axes: {
                activeusers: 'y',
                newusers: 'y2',
                notcomingback: 'y2',
                pageviews: 'y'
            },
            types: {
                activeusers: line,
                newusers: line,
                notcomingback: line,
                pageviews: line
            },
            colors: {
                activeusers: black,
                newusers: steelblue,
                notcomingback: green,
                pageviews: yellow
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
}


var kindMap = {
    'impressions': [ 'daily/impressions', renderImpression ],
    'users': [ 'daily/users', renderUsers ],
    'metadata': [ false, 'daily/metadata', renderMetadata ]
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

