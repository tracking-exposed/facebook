let $grid;

function initializeSummary() {
  const token = _.find(window.location.pathname.split('/'), function(e) {
    return _.size(e) == 40;
  });

  const url = `${window.location.origin}/api/v1/summary/${token}`;
  // $('#summary').html(`<a href="${url}">${url}</a>`);

  $.getJSON(url, function(data) {
    // research in progress, to split the post by timeline 
    var x = _.groupBy(data, 'timeline');
    console.log(x);
    _.each(data, function(item) {

      if(_.size(item.texts))
          console.log(item);

      // Don't display entries that have errors
      if (item.errors.length) {
        console.log("suppressing the object because of errors in:", item.errors);
        return;
      }

      const readableDate = moment(item.publicationTime, moment.ISO_8601).format('MMMM Do YYYY, hh:mm a');

      let bgColorClass,
          entryType,
          isPost,
          teaserText;
      switch (item.type) {
        case 'photo':
          bgColorClass = 'alert-success';
          entryType = 'picture';
          break;
        case 'videos':
          bgColorClass = 'alert-primary';
          entryType = 'video';
          break;
        case 'groups':
          bgColorClass = 'alert-warning';
          entryType = 'group';
          break;
        case 'events':
          bgColorClass = 'alert-info';
          entryType = 'event';
          break;
        case 'posts':
          bgColorClass = 'alert-secondary';
          entryType = 'post';
          break;
        default:
          console.log("unmanaged type", item.type);
          break;
      }

      /* every kind of entry might contain some text */
      console.log(_.size(item.texts));
      let hasText = false;

      if(_.size(item.texts) && _.some(item.texts, _.size)) {
          const maxStringLength = 50;

          /* are sure the texts[].text is order by the longest */
          selectedText = _.first(_.orderBy(item.texts, _.size)).text;

          teaserText = selectedText.length > maxStringLength
            ? selectedText.substring(0, maxStringLength) + '…'
            : selectedText;
          hasText = true;
      }

      const gridItem = `
        <div class="grid-item ${item.type || ''}">
          <article class="content ${bgColorClass} d-flex flex-column">
            <header>${entryType || ''}</header>
            <section class="body">
              <span class="small post-date">${readableDate}</span>
              <p><b class="post-author">${item.author}</b>
                ${hasText
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
    });
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
