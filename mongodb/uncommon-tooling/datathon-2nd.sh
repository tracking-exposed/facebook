#!/bin/sh

if [ ! $1 ]; then
    echo "you need a directory full of week-*.json files as argument"
    exit
fi

files=`ls $1/week*.json`

for f in $files; do 
    timelines=`cat $f`
    well=`cat $f | sed -es/timelineId/id/`
    mongodump -d facebook -c htmls2 --query "$timelines"
    mongodump -d facebook -c impressions2 --query "$timelines"
    mongodump -d facebook -c timelines2 --query "$well"
done
