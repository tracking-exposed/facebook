let $grid;

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

      const readableDate = moment(item.publicationTime, moment.ISO_8601).format('MMMM Do YYYY, hh:mm a');

      let bgColorClass,
          entryType,
          isPost,
          teaserText;
      switch (item.type) {
        case 'photo':
          bgColorClass = 'alert-success';
          entryType = item.type;
          break;
        case 'videos':
          bgColorClass = 'alert-primary';
          entryType = 'video';
          break;
        case 'groups':
          bgColorClass = 'alert-warning';
          entryType = 'group';
          break;
        default:
          bgColorClass = 'alert-secondary'
          entryType = 'post';
          isPost = true;
          const maxStringLength = 50;
          teaserText = item.texts[0].text.length > maxStringLength
            ? item.texts[0].text.substring(0, maxStringLength) + '…'
            : item.texts[0].text;
          break;
      }

      const gridItem = `
        <div class="grid-item ${item.type || ''}">
          <article class="content ${bgColorClass} d-flex flex-column">
            <header>${entryType || ''}</header>
            <section class="body">
              <span class="small post-date">${readableDate}</span>
              <p><b class="post-author">${item.author}</b>
                ${isPost
                  ? '<a href="https://facebook.com' + item.permaLink + '" title="Go to post" target="_blank" class="text-link">'+ teaserText +'</a>'
                  : ''}
              </p>
            </section>
            <footer>
              <span class="small ${item.postId ? 'post-id' : ''}">
                ${item.postId ? 'Post ID: #'+item.postId : '#'}
              </span>
            </footer>
          </article>
        </div>
      `;
      $('#summary').append(gridItem);
    }
    initIsotope();
  });
};

function initIsotope() {
  $grid = $('.grid').isotope({
    // set itemSelector so .grid-sizer is not used in layout
    itemSelector: '.grid-item',
    percentPosition: true,
    masonry: {
      // use element for option
      columnWidth: '.grid-sizer'
    }
  });
}

function filterBy(filter = '*') {
  console.log(filter)
  $grid.isotope({ filter });
}
