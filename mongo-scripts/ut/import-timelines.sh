cd /tmp

tempdir='unit-test-importer'
cd /tmp
if [ -d $tempdir ]; then
    echo "removing $tempdir";
    rm -rf $tempdir
fi

mkdir $tempdir; cd $tempdir

ssh -i ~/.ssh/trackset tracking@testing.tracking.exposed "/facebook/mongo-scripts/mongo-scripts/last-15-timelines.sh"
rsync  -i ~/.ssh/trackset 'tracking@testing.tracking.exposed:/tmp/unit-test-l15/*' .

timelineIds=`ls | grep -v last-`

for timelineId in $timelineIds; do
    mv $timelineId/facebook $timelineId/fbtestsource
    mongorestore --gzip $timelineId
done
