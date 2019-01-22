
function createAppend(post, n) {

    var html = `
        <div class="infoblock col-md-12">
            ${n+1}
        </div>
        <div class="col-md-12">
            <div class="col-md-8">
                <h3>metadata ${n+1}</h3>
                <pre>
                    ${JSON.stringify(post.metadata, undefined, 2)}
                </pre>
                <div class=${post.errors ? "warning" : "hidden"}>
                    <h3>errors ${n+1}</h3>
                    <pre>
                        ${JSON.stringify(post.errors, undefined, 2)}
                    </pre>
                </div>
            </div>
            <div class="col-md-4">
                <h3>snippet ${n+1}</h3>
                ${post.html.html}
            </div>
        </div>
`;
    return html;
};

function unrolltimeline(dest)  {
    const timelineId = document.location.pathname.split('/').pop();
    if(timelineId.length !== 40) {
        $(source).html('<h3>Expected timeline as parameter</h3>');
        return;
    }

    const url = '/api/v1/verify/' + timelineId;
    $.getJSON(url, function(all) {
        console.log(`available ${_.size(all)} posts`);
        _.each(all, function(postProcessed, n) {
            let createdHTML = createAppend(postProcessed, n);
            $(dest).append(createdHTML);
            console.log(`appended element number: ${n+1}`);
        });
    });
};
