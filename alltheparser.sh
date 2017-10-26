#!/bin/sh
DEBUG=* url="http://localhost:8000" since="2017-10-25" parsers/postType.js 
DEBUG=* url="http://localhost:8000" since="2017-10-25" parsers/promotedTitle.js 
DEBUG=* url="http://localhost:8000" since="2017-10-25" parsers/promotedLink.js 
DEBUG=* url="http://localhost:8000" since="2017-10-25" parsers/promotedInfo.js 
DEBUG=* url="http://localhost:8000" since="2017-10-25" parsers/feedUTime.js 
DEBUG=* url="http://localhost:8000" since="2017-10-25" parsers/feedBasicInfo.js 
DEBUG=* url="http://localhost:8000" since="2017-10-25" parsers/feedText.js 
DEBUG=* url="http://localhost:8000" since="2017-10-25" parsers/feedHref.js 
DEBUG=* url="http://localhost:8000" since="2017-10-25" parsers/imageAltTag.js 
echo "Done this round, sleeping..."
