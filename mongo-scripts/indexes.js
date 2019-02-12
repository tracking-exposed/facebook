db.feeds.createIndex({id: 1}, {unique: true });

db.labels.createIndex({ "semanticId" : 1 }, { unique: true });
db.labels.createIndex({ "when" : 1 });

db.metadata.createIndex({ "semanticId" : 1 });
db.metadata.createIndex({ "userId" : 1 });
db.metadata.createIndex({ "semantic" : 1 });
db.metadata.createIndex({ "id" : 1 }, { unique : true });

db.semantics.createIndex({ "label" : 1 });
db.semantics.createIndex({ "when" : 1 });
db.semantics.createIndex({ "semanticId" : 1 });

