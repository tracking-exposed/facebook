cd ~/Dev/dumps/2018/
for i in `seq 1 52`; do mongorestore --db=2018 week-$i/2018; done 
cd ~/Dev/facebook/
mongo 2018 mongodb/init/build-indexes.js
time elastic=disabled since=2018-01-01 until=2018-12-31 parsers/range.js
