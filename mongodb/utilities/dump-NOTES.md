## dump with timing selection

    mongodump -d facebook -c htmls2 --query "{\"savingTime\":{\"\$gt\":{\"\$date\":`date -d 2018-06-01 +%s`000}}}"
    mongodump -d facebook -c impressions2 --query "{\"impressionTime\":{\"\$gt\":{\"\$date\":`date -d 2018-06-01 +%s`000}}}"
    mongodump -d facebook -c timelines2 --query "{\"startTime\":{\"\$gt\":{\"\$date\":`date -d 2018-06-01 +%s`000}}}"

## shell script used to dump by user, a better version been used with an array (rif: DATAJLAB19): todo, document it

#!/bin/sh
userId=$1
echo "Dumping by $userId"

mongodump -d facebook -c htmls2 --query "{\"userId\":$userId}" 
mongodump -d facebook -c timelines2 --query "{\"userId\":$userId}"
mongodump -d facebook -c impressions2 --query "{\"userId\":$userId}"




