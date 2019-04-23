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
    if(htmlId.length !== 40) {
        $("#error").html('<h3>URL error.</h3>');
        $("html").html('<h3>check htmlId</h3>');
        return;
    }

    var url = `/api/v2/debug/html/${htmlId}`;
    console.log(url);

    $.getJSON(url, function(data) {
        $("#error").html(unrollList(data.error));
        $("#metadata").html(unrollList(_.omit(data.metadata, ['notes'])));
        $("#summary").html(unrollList(data.summary));
        $("#notes").html(unrollList(_.pick(data.metadata, ['notes'])));

        $("#html").html(data.html.html);
    });
};
