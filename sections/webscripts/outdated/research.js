function fillSubjbectGraphs(filters, byUser, bySource, byiTime, byType) {
    console.log("fillSubjectGraphs");
    console.log(containerId);
};


function distinct(activityGraphId, activeListId) {
    var url = '/api/v1/distinct/authkey';
    d3.json(url, function(something) {
        console.log(something);
    });
};


function landingInit() {

    var researcher = window.location.pathname.split('/').pop();
    var url = '/api/v1/qualitative/' + researcher + '/overview';
    console.log(url);

    /* #projectName and #graphContainer */
    $.getJSON(url, function(sth) {

        $("#results").removeClass('hidden');
        $("#projectName").text("Placeholder");

        c3.generate({
            data: {
                xFormat: '%Y-%m-%d',
                json: sth,
                labels: true,
                keys: { value: ["evaluated", "notyet" ], x: 'day' },
                type: 'bar'
            },
            axis: {
                x: {
                    type: 'timeseries',
                    tick: {
                        format: '%Y-%m-%d'
                    }
                },
            },
            bindto: '#graphContainer'
        });

        var tableHtml = "";
        _.each(_.orderBy(sth, 'day'), function(entry, i) {

            tableHtml += [
                "<tr>", 
                    "<td>" + (i + 1) + "</td>", 
                    "<td><a href='/qualitative/" + researcher + "/day/" + entry.day + "'>" + entry.day + "</a></td>",
                    "<td>" + entry.evaluated + "</td>",
                    "<td>" + entry.notyet + "</td>",
                "</tr>"
            ].join("");
        });
        $("#tableContent").append(tableHtml);
    });
};


function renderPostAndCheckboxes() {

    var day = window.location.pathname.split('/')[4];
    var researcher = window.location.pathname.split('/')[2];
    var url = '/api/v1/qualitative/' + researcher + '/day/' + day;

    $.getJSON(url, function(posts) {

        var processed = _.size(_.filter(posts, { evalueted: true }));
        var notyet = _.size(posts) - processed;

        $("#postList").append(
            '<div class="col-md-1"></div>' +
            '<div class="col-md-10">' +
                '<h2>Posts from ' +
                day +
                ' (' +
                moment.duration(moment() - moment(day)).humanize() +
                ' ago) <b>' +
                _.size(posts) +
                '</b> — processed/notyet <b>' +
                processed +
                '</b>/<b>' +
                notyet +
                '</b></h2>' +
            '</div>'
        );

        _.each(posts, function(post) {
            $("#postList").append(evaluationHTML(post));
        });
    });
};


function sendvalues(t) {
    // TODO manage status of update/unchaned/loading in the button
    var postIdString = $(t).attr('id');
    var changes = _.get(modsInProgress, postIdString);
    if(!changes)
        return;

    var researcher = window.location.pathname.split('/')[2];
    var url = '/api/v1/qualitative/' + researcher + '/update/' + postIdString;
    $.ajax({
        url: url,
        data: JSON.stringify(changes),
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST'
    }, function(result) {
        console.log("done", result, "-->", url);
    });
};

var modsInProgress = {};

function reportClick(e) {
    var completeId =  $(e).attr('id');
    var postId = completeId.split('-')[0];
    var groupName = completeId.split('-')[1];
    var newValue = $(e).is(':checked');
    var name = $(e).attr('name');

    if(_.isUndefined(_.get(modsInProgress, postId)))
        _.set(modsInProgress, postId, []);

    modsInProgress[postId].push({
        name: name,
        value: newValue,
        group: groupName
    });
};


function renderCheckboxes(qualitative, postId) {

    var checkboxes = [];
    _.each(_.groupBy(qualitative, 'group'), function(bools, gname) {
        var lista = [ '<span class="col-md-1" style="width: 100%;">', '<h3>', gname, '</h3>' ];

        _.each(bools, function(checkbox, cboxnumber) {
            var isChecked = checkbox.value ? 'checked' : '';
            var cboxhtml = [
                '<input onclick="reportClick(this);" id="' +
                    [ postId, gname, cboxnumber ].join('-') +
                    '" name="' + 
                    checkbox.field +
                    '" type="checkbox" ' + 
                    isChecked +
                '>',
                checkbox.field,
                '</input><br>'
            ];
            lista.push( cboxhtml.join('') );
        });

        lista.push('</span>');
        checkboxes.push( lista.join('') );
    });
    return checkboxes.join('');
};


function renderPostInfo(post) {
    return [
        '<small>',
            '#' + _.size(post.occurrencies),
        '</small></br>',
        '<p><i>',
            post.userPseudo,
        '</i></p>',
        '<small>',
            post.geoip,
        '</small></br>',
        '<a href="https://www.facebook.com' + post.permaLink + '" target=_blank>original 🔗 </a>'
    ].join('');
};


function evaluationHTML(post) {
    return [
        '<div class="container-fluid bluetteline">',
            '<div class="col-md-1">',
                renderPostInfo(post),
            '</div>',
            '<div class="col-md-4">',
                '<div>',
                    post.html,
                '</div>',
            '</div>',
            '<div class="col-md-4 evalwindow" id="post-'+ post.postId +'">',
                renderCheckboxes(post.qualitative, post.postId),
            '</div>',
            '<div class="col-md-1"></div>',
            '<button onclick="sendvalues(this);" class="sendeval" id="' + post.postId + '">update</button>',
        '</div>',
   ].join('');
};
