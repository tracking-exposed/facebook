function fillSubjbectGraphs(filters, byUser, bySource, byiTime, byType) {

    console.log("fillSubjectGraphs");
    console.log(containerId);

};

function distinct(activityGraphId, activeListId) {
    console.log("distinct");

    var url = '/api/v1/distinct/authkey';
    d3.json(url, function(something) {
        console.log(something);
    });
};
