ret = db.labels.createIndex({ "semanticId" : 1 }, { unique: true }); checkret('labels semanticId', ret);
ret = db.labels.createIndex({ "when" : 1 }); checkret('labels when', ret);

ret = db.metadata.createIndex({ "semanticId" : 1 }); checkret('metadata semanticId', ret);
ret = db.metadata.createIndex({ "userId" : 1 }); checkret('metadata userId', ret);
ret = db.metadata.createIndex({ "semantic" : 1 }); checkret('metadata semantic', ret);
ret = db.metadata.createIndex({ "id" : 1 }, { unique : true }); checkret('metadata id', ret);
ret = db.metadata.createIndex({ "impressionTime" : -1 }); checkret('metadata impressionTime', ret);
ret = db.metadata.createIndex({ "linkedtime.postId" : 1 }); checkret('metadata linkedtime.postId', ret);

ret = db.semantics.createIndex({ "label" : 1 });
ret = db.semantics.createIndex({ "when" : 1 });
ret = db.semantics.createIndex({ "semanticId" : 1 });

ret = db.parsererrors.createIndex({ "id": 1 }); checkret('parsererror id', ret);

ret = db.aggregated.createIndex({ "hourId": 1 }, {unique: true}); checkret('aggregated hourId', ret);

ret = db.summary.createIndex({ "id": 1 }, { unique: true }); checkret('summary id', ret);
ret = db.summary.createIndex({ "impressionTime": -1 }); checkret('summary impressionTime', ret);
ret = db.summary.createIndex({semanticId: 1}); checkret('summary semanticId', ret);
ret = db.summary.createIndex({user: -1 }); checkret('summary user', ret);
ret = db.summary.createIndex({timeline: 1}); checkret('summary timeline', ret);

ret = db.feeds2.createIndex({lang: 1, label: 1}, {unique: true }); checkret('feeds2 lang+label', ret);
ret = db.feeds2.createIndex({createdAt: 1}, {expireAfterSeconds: 3600 / 2}); checkret('createdAt expiring after 30minutes', ret);


function checkret(info, retval) {
    retval.info = info;
    printjson(retval);
};
