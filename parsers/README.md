# shared options

an option can be specify as an environment variable or as an --option

  * `DEBUG`: as usual by debug module, my recipe is `DEBUG=*,-lib:mongo:read`
  * `repeat`: anything or nothing, it make reprocess HTML snippets already processed
  * `elastic`: mark it as 'disabled' if no logging is need

## range.js

  * `since`: YYYY-MM-DD
  * `until`: YYYY-MM-DD

## precise.js

  * `id`: specify an html.id (which become a metadata.id) 

## timeline.js

  * `id`: specify a timeline.id, it processed all the snippet belongin to
