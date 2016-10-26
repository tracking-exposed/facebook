
# Anomalies Managmement

from ESCVI root:

    mkdir samples

daily duty: (still todo a cleaner from /dev/shm)

    operations/importerror.sh

then run the (not yet interactive)

    anomaly=1 mongodb="mongodb://localhost/biny" npm run watch

note: anomaly ENV variable permit to save the anomalies happening, if
is set to 0 don't save. it is set in config/settings.json

    DEBUG=* delay=2000 anomalies/resender.js

when you spot an error in the console of ESCVI, you press ^c, copy paste the last file as --file=filename.json in the argument, for example:

    delay=1500 DEBUG=* anomalies/resender.js --file=parsingError-104444444444444-080049.json

and iterated with your debug.
To loop again with the new saved errors, this script move files from /dev/shm to ./errors/client and ./errors/server

    operations/looperror.sh

# Reparsing

This new approach uses the parsing code of the userscript (copied in 
'userscrip/fb-parser.js') and want re-executed the section of HTML that
generates errors

this can permit to aproach the parsing issues in the userscrpt and use better
CSS selector https://www.w3.org/TR/css3-selectors/ instead of parsing and regexp

    DEBUG=* PRINT=1 operations/reparse.js

# Node sync/clone

    DEBUG=* source='https://facebook.tracking.exposed' operations/importer.js


