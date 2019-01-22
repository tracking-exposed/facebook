function initializeSummary() {
    const token = _.find(window.location.pathname.split('/'), function(e) {
        return _.size(e) == 40;
    });
    const url = `${window.location.origin}/api/v1/summary/${token}`;
    // $('#summary').html(`<a href="${url}">${url}</a>`);
    $.getJSON(url, function(data) {
      console.log(data);
      
      for (let i = 0; i < 20; i++) {
        const gridItem = `<div class="col-sm-6 col-md-4 col-lg-2">${data[i].author}</div>`;
        $('#summary').append(gridItem);
      }
    });
};
