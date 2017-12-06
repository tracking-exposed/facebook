#!/bin/sh
DEBUG=* url="http://localhost:8000" parsers/postType.js
DEBUG=* url="http://localhost:8000" parsers/promotedTitle.js
DEBUG=* url="http://localhost:8000" parsers/promotedLink.js
DEBUG=* url="http://localhost:8000" parsers/promotedInfo.js
DEBUG=* url="http://localhost:8000" parsers/feedUTime.js
DEBUG=* url="http://localhost:8000" parsers/feedBasicInfo.js
DEBUG=* url="http://localhost:8000" parsers/feedText.js
DEBUG=* url="http://localhost:8000" parsers/feedHref.js
DEBUG=* url="http://localhost:8000" parsers/imageAltTag.js
echo "Done this round, sleeping..."
