curl -X PUT "127.0.0.1:9200/fbtrex" -H 'Content-Type: application/json' -d'
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
