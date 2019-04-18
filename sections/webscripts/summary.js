let $grid;

function getToken() {
  let t = _.find(window.location.pathname.split('/'), function(e) {
    return _.size(e) == 40;
  });
  if(!t) console.log("Wrong token length in the URL");
  return t;
}

function initializeSummary() {

  const token = getToken();
  const url = `${window.location.origin}/api/v2/personal/${token}/summary`;

  $.getJSON(url, (data) => {
    console.log(`Retrived ${_.size(data)} objects`);
    _.each(data, (item) => {

      const date = moment(item.publicationTime, moment.ISO_8601),
        readableDate = date.format('MMMM Do YYYY, hh:mm a'),
        unixTimestamp = date.format('x'),
        maxStringLength = 150;

      let bgColorClass, entryType, selectedText, teaserText, hasText = false;
      switch (item.fblinktype) {
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
          console.log("unmanaged type: ", item.type);
          break;
      }

      if(_.size(item.texts) && _.some(item.texts, _.size)) {

        /* are sure the texts[].text is order by the longest */
        selectedText = _.first(_.orderBy(item.texts, _.size));
        teaserText = selectedText.length > maxStringLength
          ? selectedText.substring(0, maxStringLength) + '…'
          : selectedText 
        hasText = true;
      }

      let linkslot ="";
      if(_.startsWith(item.permaLink, '/')) 
        linkslot = `<a href="https://facebook.com${item.permaLink}" title="Go to post" target="_blank" class="small text-link">Go to post</a>`;
      else if(_.startsWith(item.permaLink, 'https://'))
        linkslot = `<a href="${item.permaLink}" title="Go to post" target="_blank" class="small text-link">Go to post</a>`;

      const gridItem = `
        <div class="grid-item ${item.fblinktype || ''}">
          <article class="content ${bgColorClass} d-flex flex-column">
            <header>${entryType || ''}</header>
            <section class="body">
              <span class="small date" data-date="${unixTimestamp}">${readableDate}</span>
              <h4 class="author">${item.source}</h4>
              ${hasText ? `<p class="teaser">${teaserText}</p>` : ''}
            </section>
            <footer>
              <span class="small ${item.postId ? 'post-id' : ''}" data-post-id="${item.postId}">
                ${item.postId ? 'Post Id: #'+item.postId : '#'}
              </span>
              ${linkslot}
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

function downloadCSV() {
  const token = getToken();
  const url = "/api/v1/csv/" + token;
  console.log("downloadCSV from: ", url);
  window.open(url);
}
