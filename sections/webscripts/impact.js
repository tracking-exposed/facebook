var displayTimeAdoption = function(containerId) {
    var url = '/api/v1/node/activity/c3';
    d3.json(url, function(something) {
        console.log("displayTimeAdoption");
        console.log(something);

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

var displayCountryPie = function(containerId) {
    var url = '/api/v1/node/countries/column';
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

