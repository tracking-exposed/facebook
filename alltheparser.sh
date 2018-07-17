#!/bin/bash
DEBUG=* url="http://localhost:8000" parsers/postType.js
DEBUG=*,-parser:core url="http://localhost:8000" parsers/promotedTitle.js 2>&1 >&/tmp/promoted.log
DEBUG=*,-parser:core url="http://localhost:8000" parsers/promotedLink.js
DEBUG=*,-parser:core url="http://localhost:8000" parsers/promotedInfo.js
DEBUG=*,-parser:core url="http://localhost:8000" parsers/feedUTime.js
DEBUG=*,-parser:core url="http://localhost:8000" parsers/feedBasicInfo.js
DEBUG=*,-parser:core url="http://localhost:8000" parsers/feedText.js
DEBUG=*,-parser:core url="http://localhost:8000" parsers/feedHref.js
DEBUG=*,-parser:core url="http://localhost:8000" parsers/imageAltTag.js
echo "Done this round, sleeping..."
