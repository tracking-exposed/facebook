mongodump -d facebook -c htmls2 --query "{\"savingTime\":{\"\$gt\":{\"\$date\":`date -d 2018-06-01 +%s`000}}}"
mongodump -d facebook -c impressions2 --query "{\"impressionTime\":{\"\$gt\":{\"\$date\":`date -d 2018-06-01 +%s`000}}}"
mongodump -d facebook -c timelines2 --query "{\"startTime\":{\"\$gt\":{\"\$date\":`date -d 2018-06-01 +%s`000}}}"
mongodump -d facebook -c supporters2 
