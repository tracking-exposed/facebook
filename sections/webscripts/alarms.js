
function hostess(e) {
    console.log("Hostess and Stuarts will help us in the Boarding procedure, for impaired traveller unable to provide their public key in a public post…");
    var password = $('#password').val();
    var manualboardingURL = '/api/v1/manualboarding?' + e.target.innerText + "&password=" + password;
    var supporterId = e.target.classList[1];
    return $.getJSON(manualboardingURL, function(result) {
        console.log(result);
        $("." + supporterId).text(result);
        $("." + supporterId).fadeOut(2000);
    });
};


function loadAlarms(dayback, containerId) {
    var url = '/api/v1/alarms';

    $.getJSON(url, function(collection) {
        _.each(collection, function(alarm) {
            /* "what": "supporter not found", */
            if(alarm.what === "supporter not found") {
                $(containerId).append('<div>'+ alarm.when +' <span class="stuart '+ alarm.info.supporterId + '">publicKey=' + alarm.info.publickey + '&userId=' + alarm.info.supporterId + '</span></div>');
            } else {
                $(containerId).append('<pre>' + JSON.stringify(alarm, undefined, 2) + '</pre>');
            }
        });
        $(".stuart").click(hostess);
    });
}
