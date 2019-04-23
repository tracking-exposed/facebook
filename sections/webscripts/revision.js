function unrollList(o) {
    return ('<ul class="revisionList">' +
            _.reduce(o, function(memo, v, k) {
                var initial = '<li>' + '<code>' + k + '</code>: ';
                if(typeof v == 'object') {
                    memo += initial + '<pre>' + JSON.stringify(v, undefined, 2) + "</pre>";
                } else{
                    memo += initial + v;
                }
                memo += "</li>";
                return memo;
            }, "")
        + '</ul>');
};

function loadmetadata() {
    var htmlId = document.location.pathname.split('/').pop();
    if(htmlId.length != 40) {
        // wrong size, nonsene
        $('#fulltable').hide();
        $('#rendered').text("ID looks of the wrong size: plese verify");
        return;
    }

    var url = `/api/v2/debug/html/${htmlId}`;
    console.log(url);

    $.getJSON(url, function(data) {
        if(data.error) {
            // not found?
            $('#fulltable').hide();
            $('#rendered').text("ID not found; has been expired or incorrect");
            return;
        }
        $("#error").html(unrollList(data.error));
        $("#metadata").html(unrollList(_.omit(data.metadata, ['notes'])));
        $("#summary").html(unrollList(data.summary));
        $("#notes").html(unrollList(_.pick(data.metadata, ['notes'])));

        $("#html").html(data.html.html);
    });
};
