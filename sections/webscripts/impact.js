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
                value: [ 'htmls', 'impressions', 'timelines' ]
            },
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


var kindMap = {
    'impressions': 'daily/impressions',
    'users': null, // 'daily/users',
    'metadata': null
};

function byDay(kind, containerId) {

    if(_.isNull(kindMap[kind])) {
        console.log("not yet supported", kind);
        return;
    }

    var url = '/api/v1/' + kindMap[kind];
    console.log("Fetching for", kind, url);
    d3.json(url, function(something) {
        console.log("Got it!", url);
        console.log(something);

        var chart = renderImpression(something, containerId);
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

