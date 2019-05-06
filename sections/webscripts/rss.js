
const rssIcon="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjxzdmcgaGVpZ2h0PSI1MTJweCIgaWQ9IkxheWVyXzEiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDUxMiA1MTI7IiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEycHgiIHhtbDpzcGFjZT0icHJlc2VydmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6Y2M9Imh0dHA6Ly9jcmVhdGl2ZWNvbW1vbnMub3JnL25zIyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIiB4bWxuczpzb2RpcG9kaT0iaHR0cDovL3NvZGlwb2RpLnNvdXJjZWZvcmdlLm5ldC9EVEQvc29kaXBvZGktMC5kdGQiIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzIGlkPSJkZWZzMTkiLz48ZyBpZD0iZzMwMjEiLz48ZyBpZD0iTGF5ZXJfMV8xXyIvPjxnIGlkPSJMYXllcl8xXzFfLTciIHRyYW5zZm9ybT0idHJhbnNsYXRlKC04MTkuNjcyLC02MS45Mjk5OTEpIi8+PGcgaWQ9ImcyOTg5Ij48cmVjdCBoZWlnaHQ9IjUxMiIgaWQ9InJlY3QyOTg5IiByeD0iNzAiIHJ5PSI3MCIgc3R5bGU9ImZpbGw6I2VhNzgxOTtmaWxsLW9wYWNpdHk6MTtzdHJva2U6bm9uZSIgdHJhbnNmb3JtPSJzY2FsZSgtMSwtMSkiIHdpZHRoPSI1MTIiIHg9Ii01MTIiIHk9Ii01MTIiLz48cGF0aCBkPSJtIDgxLjA1NjQzLDI2Ny4wNDk1OCBjIDQzLjcwNDEsMCA4NC43ODg3OSwxNy4wNzIxNCAxMTUuNjY0MDcsNDguMTIzOTUgMzAuOTMxNzksMzEuMDUxNzkgNDcuOTYxNTYsNzIuNDExODQgNDcuOTYxNTYsMTE2LjQ0MDcyIGggNjcuMzQ5NTEgYyAwLC0xMjcuODg1NyAtMTAzLjYxODk4LC0yMzEuOTIxMjQgLTIzMC45NzUxNCwtMjMxLjkyMTI0IHYgNjcuMzU2NTcgeiBNIDgxLjE2MjQsMTQ3LjY1MDU0IGMgMTU1Ljc2MDMsMCAyODIuNDg4MDgsMTI3LjQxOTcgMjgyLjQ4ODA4LDI4NC4wNDg0NCBIIDQzMSBDIDQzMSwyMzcuOTI1MjggMjc0LjA1MzU0LDgwLjMwMTAyIDgxLjE2MjQsODAuMzAxMDIgdiA2Ny4zNDk1MiB6IG0gOTMuMTM0MjEsMjM2Ljk5NzY5IGMgMCwyNS43NTY0NyAtMjAuODkxODMsNDYuNjQ4MyAtNDYuNjQ4Myw0Ni42NDgzIEMgMTAxLjg5MTg0LDQzMS4yOTY1MyA4MSw0MTAuNDExNzYgODEsMzg0LjY0ODIzIGMgMCwtMjUuNzcwNiAyMC44ODQ3NywtNDYuNjQ4MzEgNDYuNjQxMjQsLTQ2LjY0ODMxIDI1Ljc1NjQ5LDAgNDYuNjU1MzcsMjAuODc3NzEgNDYuNjU1MzcsNDYuNjQ4MzEgeiIgaWQ9InBhdGgzODQ0IiBzdHlsZT0iZmlsbDojZmZmZmZmIi8+PC9nPjwvc3ZnPg==";

function buildRSS(e, ui) {
    console.log(ui.item.value);
    const escaped = escape(ui.item.value);
    $("#status").html(`
        <img style="width:20px" src="${rssIcon}">
        <span class="monospace">
            https://facebook.tracking.exposed/feeds/${escaped}
        </span>
    `);
};

const availableKeywords = {};
function fetchLanguage(lang) {
    if(availableKeywords[lang])
        configureAutocomplete(lang);
    const url = `/api/v2/keywords/${lang}`;
    $.getJSON(url, function(kwds) {
        $("#status").text("You can query only by using wikipedia titles");
        availableKeywords[lang] = _.map(kwds, 'k');
        configureAutocomplete(lang);
    });
};

function configureAutocomplete(lang) {
    $("#inputbar").autocomplete({
        source: availableKeywords[lang],
        autoFocus: true,
        minLength: 0,
        select: buildRSS
    });
    $("#inputbar").on("autocompleteselect", buildRSS);
}

function loadLanguages() {
    $(".hidden").toggle();
    $.getJSON("/api/v2/languages", function(langdesc) {
        // { available: { af: 2, ar: 73 }, { potential: { uk: "Ukrainian", no: "Norwegian" } }
        _.each(langdesc.potential, function(langName, lcode) {
            let entry=`<button type='button' id='${lcode}' class="btn notavail">
                ${langdesc.potential[lcode]}
            </button>`;
            $('#available').append(entry);
        });
        _.each(langdesc.available, function(amount, lcode) {
            $("#" + lcode).removeClass('notavail');
            $("#" + lcode).addClass('selectable');
            $("#" + lcode).addClass('alert-success');
        });
        $(".notavail").click(function(e) {
            $(".hidden").show();
            const id = this.id;
            $("#counter").text("Not seen in the last week any message with more than 280 chars from this language");
            $("#language").text(langdesc.potential[id]);
        });
        $(".selectable").click(function(e) {
            $(".hidden").show();
            const id = this.id;
            $("#counter").text(langdesc.available[id]);
            $("#language").text(langdesc.potential[id]);
            $("#status").text("Loading...");
            fetchLanguage(id);
        });
    });
};
