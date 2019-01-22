function initializeSummary() {
    const token = _.find(window.location.pathname.split('/'), function(e) {
        return _.size(e) == 40;
    });
    const url = `${window.location.origin}/api/v1/summary/${token}`;
    // $('#summary').html(`<a href="${url}">${url}</a>`);
    $.getJSON(url, function(data) {
      console.log(data);
      for (let i = 0; i < 20; i++) {
        const item = data[i];

        // Don't display entries that have errors
        if (item.errors.length) {
          continue;
        }

        const gridItem = `
          <article class="col-sm-6 col-md-4 col-lg-2 grid-item ${item.type || ''}">
            <header>
              <span class="small ${item.postId ? 'post-id' : ''}">${item.postId || '#'}</span>
            </header>
            <section class="body">
              <p><b>${item.author}</b></p>
              ${item.permaLink
                ? '<a href="https://facebook.com' + item.permaLink + '" title="Go to post" target="_blank">'+ item.permaLink +'</a>'
                : ''}
            </section>
          </article>
        `;
        $('#summary').append(gridItem);
      }
    });
    $('.grid').isotope({
      // options
      itemSelector: '.grid-item'
    });
};
