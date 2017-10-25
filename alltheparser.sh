#!/bin/sh
DEBUG=* url="http://localhost:8000" since="2017-10-01" parsers/postType.js 
DEBUG=* url="http://localhost:8000" since="2017-10-01" parsers/promotedTitle.js 
DEBUG=* url="http://localhost:8000" since="2017-10-01" parsers/promotedLink.js 
DEBUG=* url="http://localhost:8000" since="2017-10-01" parsers/promotedInfo.js 
DEBUG=* url="http://localhost:8000" since="2017-10-01" parsers/feedUTime.js 
DEBUG=* url="http://localhost:8000" since="2017-10-01" parsers/feedBasicInfo.js 
DEBUG=* url="http://localhost:8000" since="2017-10-01" parsers/feedText.js 
DEBUG=* url="http://localhost:8000" since="2017-10-01" parsers/feedHref.js 
DEBUG=* url="http://localhost:8000" since="2017-10-01" parsers/imageAltTag.js 
echo "Done this round, sleeping..."

