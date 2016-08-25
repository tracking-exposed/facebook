
# Anomalies Managmement

from ESCVI root:

    mkdir samples

daily duty: (still todo a cleaner from /dev/shm)

    anomalies/importerror.sh

then run the (not yet interactive)

    anomaly=1 mongodb="mongodb://localhost/biny" npm run watch

note: anomaly ENV variable permit to save the anomalies happening, if
is set to 0 don't save. it is set in config/settings.json

    DEBUG=* anomalies/resender.js

when you spot an error in the console of ESCVI, you press ^c, copy paste the last file as --file=filename.json in the argument, for example:

    delay=1500 DEBUG=* anomalies/resender.js --file=parsingError-104444444444444-080049.json

and iterated with your debug.
To loop again with the new saved errors, this script move files from /dev/shm to ./samples

    anomalies/looperror.sh
