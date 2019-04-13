/* https://stackoverflow.com/questions/10114355/how-to-pass-argument-to-mongo-script

$ cat addthem.js
printjson( param1 + param2 );
$ ./mongo --nodb --quiet --eval "var param1=7, param2=8" addthem.js
15

 */

y = db.timelines2.find({"startTime":{"$gt":{"$date":week}}}).sort({"startTime": 1}).limit(1);
x = db.timelines2.find({"startTime":{"$gt":{"$date":week}}}).limit(10).count();

printjson(y.next());
printjson(x);
