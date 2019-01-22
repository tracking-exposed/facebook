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

      const date = moment(item.publicationTime, moment.ISO_8601),
        readableDate = date.format('MMMM Do YYYY, hh:mm a'),
        unixTimestamp = date.format('x');

      let bgColorClass, entryType, isPost, message, messageTeaser;
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
          const maxStringLength = 280;
          message = item.texts.find(text => {
            return text.info === 'message';
          }).text;
          messageTeaser = message.length > maxStringLength
            ? message.substring(0, maxStringLength) + '…'
            : message;
          break;
      }

      const gridItem = `
        <div class="grid-item ${item.type || ''}">
          <article class="content ${bgColorClass} d-flex flex-column">
            <header>${entryType || ''}</header>
            <section class="body">
              <span class="small date" data-date="${unixTimestamp}">${readableDate}</span>
              <p>
                <b class="author">${item.author}</b><br>
                ${isPost
                  ? '<span class="teaser">' + messageTeaser + '</span>'
                  : ''}
              </p>
            </section>
            <footer>
              <span class="small ${item.postId ? 'post-id' : ''}" data-post-id="${item.postId}">
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
    },
    getSortData: {
      postId: '[data-post-id parseInt]',
      date: '[data-date parseInt]',
      author: '.author',
    }
  });
}

function filterBy(filter = '*') {
  $grid.isotope({ filter });
}

function sortBy(value = 'original-order') {
  $grid.isotope({ sortBy: value });
}
