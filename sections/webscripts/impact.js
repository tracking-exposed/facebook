var displayTimeAdoption = function(containerId) {
    var url = '/node/activity/2/column';

    d3.json(url, function(something) {

        console.log(something);

        var chart = c3.generate({
            bindto: containerId,
            data: {
                x: 'x',
                columns: something
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

