
const availableKeywords = {};

function fetchLanguage(lang) {
    const url = `/api/v2/keywords/${lang}`;
    $.getJSON(url, function(kwds) {

        console.log("fetched", _.size(kwds));
        $("#status").text("Loaded! search among the topic observed in the last week:");

        availableKeywords[lang] = _.map(kwds, 'k');

        $( ".selector" ).autocomplete({
          source: availableKeywords[lang]
        });
    });
};

function loadLanguages() {

    $(".hidden").toggle();

    $.getJSON("/api/v2/languages", function(langdesc) {
        // { available: { af: 2, ar: 73 }, { potential: { uk: "Ukrainian", no: "Norwegian" } }
   
        _.each(langdesc.potential, function(langName, lcode) {
            let entry=`<span style="{width:25%}">
                <button type='button' id='${lcode}' class="btn notavail">${langdesc.potential[lcode]}</button>
                </span>
            `;
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
