
result = db.htmls2.aggregate( [ 
    { $match: { 
        'savingTime': { 
            "$gte": new Date("2018-05-01"),
            "$lte": new Date("2018-05-31")
        }
    }}, 
    { $project: { 
        timelineId: 1, 
        savingTime: 1, 
        promoted: { $cond: [{ $eq: [ "$type", "promoted"]}, true, false] }
    }},
    { $match: { 
        promoted: true
    }}, { 
      $group: { _id: '$timelineId', total: { $sum: 1}  } 
    } ]
)

while ( result.hasNext() ) {
    thing = result.next();
    timelineId = thing._id;
    videos = thing.total;
    amountOf = db.impressions2.count({ timelineId: timelineId });
    percent = Math.round ( ( 100 / amountOf ) * videos);
    round = Math.round( percent / 3 ) * 3; 

    if(amountOf > 5) 
        print(round);
}
