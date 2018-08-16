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

function specialInit() {

    console.log(window.location);
    console.log(window.location.pathname);



    $("#shoot").on('click', function(e) {
        console.log("click happen");
    });
};


function postObject() {

    var subjects = [
      'Government',
      'Parliamento',
      'Local Issue',
      'General theme',
      'M5S',
      'Media Debate',
      'Value Statement',
      'Personal Consideration'
    ];
};

function goal1() {

    var goals = [
        'Oversight (o surveillance)',
        'Prevention (o interdiction)',
        'Judgement (o evaluation)'
    ];
};

function goal2() {
    var goals = [
        'Responsiveness statement',
        'Accountability Statement',
        'Engagment',
        'Constituency services & advocacy',
        'Outreach initiatives',
        'Personal',
        'Other'
    ];
};
