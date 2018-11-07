#!/bin/sh
if [ $DOCKER ]
then
    SERVER="elastic"
else
    SERVER="127.0.0.1"
fi

curl -X PUT "$SERVER:9200/fbtrex_mongo" -H 'Content-Type: application/json' -d'
{
  "mappings" : {
      "doc" : {
      "dynamic": false,
      "properties": {
        "type":    { "type": "keyword"  },
        "feedText":{
        "dynamic": true,
        "properties":{}
       },
       "feedBasicInfo": {
         "dynamic": true,
         "properties":{}
       },
       "feedHref": {
         "dynamic": true,
         "properties":{}
       },
       "feedUTime":{
         "dynamic": true,
         "properties":{}
       },
       "promotedLink":{
         "dynamic": true,
         "properties":{}
       },
       "promotedTitle":{
         "dynamic": true,
         "properties":{}
       },
       "promotedInfo":{
         "dynamic": true,
         "properties":{}
       },
       "imageAltText": {
         "dynamic": true,
         "properties":{
       }
     },
     "savingTime": {
       "properties": {
         "$gt": {"type": "date"},
         "$lt": {"type":  "date"}
       }
     },
     "date": { "type": "date"},
       "n": {"type": "integer"}
      }
     }
  }
}
'

curl -X PUT "$SERVER:9200/fbtrex_users" -H 'Content-Type: application/json' -d'
{
  "mappings" : {
      "doc" : {
        "dynamic": false,
        "properties": {
	  "id":  {"type": "integer"},
	  "support_id": {"type": "integer"},
	  "geo": {"type": "keyword"},
	  "last_activity": {"type": "date"},
	  "timelines": {"type": "integer"},
	  "impressions": {"type": "integer"},
	  "htmls": {"type": "integer"}
        }
     }
  }
}
'
