#!/bin/sh

queryFILENAME='last-15-timelines.js'
timelineOUTPUT='last-15.log'
tempdir='unit-test-l15'

cd /tmp

if [ -d $tempdir ]; then
    echo "removing $tempdir";
    rm -rf $tempdir
fi

mkdir $tempdir; cd $tempdir

echo 'timelines = db.timelines2.find({ nonfeed: { "$exists": false}  }).sort({ startTime: -1 }).limit(15);
while(timelines.hasNext()) {
    printjson(timelines.next().id);
}' > $queryFILENAME

mongo facebook $queryFILENAME > $timelineOUTPUT
timelineIds=`grep \" $timelineOUTPUT`
for timelineId in $timelineIds; do
    mongodump -d facebook \
        -c impressions2 \
        -o $timelineId \
        --gzip \
        --query "{timelineId: $timelineId}" 
    mongodump -d facebook \
        -c timelines2 \
        -o $timelineId \
        --gzip \
        --query "{id: $timelineId}" 
    mongodump -d facebook \
        -c htmls2 \
        -o $timelineId \
        --gzip \
        --query "{timelineId: $timelineId}" 
    mongodump -d facebook \
        -c metadata \
        -o $timelineId \
        --gzip \
        --query "{timelineId: $timelineId}" 
done

