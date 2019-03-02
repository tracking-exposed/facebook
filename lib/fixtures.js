const _ = require('lodash');
const Promise = require('bluebird');
const nconf = require('nconf');

const various = require('./various');
const mongo = require('./mongo');
const utils = require('./utils');


function checkFixtures() {
    return mongo.doesMongoWorks();
};

function createFakeSemantics(what) {
    return Promise.map(what, function(collection) {
        const cName = _.get(nconf.get('schema'), collection);
        const content = _.get(fake, collection);
        if(!cName || !content) throw new Error("Invalid usage of createFakeSemantics");

        return mongo
            .writeMany(cName, content);
    }, { concurrency: 1 });
};

const semantic_userId = 2;
const semantic_Ids = [
  "782183b7c2ff33eeb283e9b23ba63934e904167a",
  "94bbc53fe4123a2367a8b7bb19bb3d8aaef8e3ae"
];

const fake = {
    labels: [{
        "semanticId" : "782183b7c2ff33eeb283e9b23ba63934e904167a",
        "lang" : "en",
        "when" : new Date("2019-01-24T02:44:05.010Z"),
        "l" : [
            "Cooking",
            "Vegan",
            "Meal",
            "Protein",
            "Carbohydrate",
            "Lipid",
            "Essential nutrient",
            "Mineral (nutrient)"
        ],
        "textsize" : 182
    }, {
        "semanticId" : "94bbc53fe4123a2367a8b7bb19bb3d8aaef8e3ae",
        "lang" : "en",
        "when" : new Date("2019-01-24T02:44:21.362Z"),
        "l" : [
            "Music",
            "Art",
            "DIY",
            "Supersonic"
        ],
        "textsize" : 274
    }],
    semantics: [{
        "semanticId" : "782183b7c2ff33eeb283e9b23ba63934e904167a",
        "label" : "Cooking",
        "title" : "Cooking",
        "spot" : "cooking",
        "wp" : "http://en.wikipedia.org/wiki/Cooking",
        "confidence" : 0.71,
        "when" : new Date("2019-01-24T02:44:05.010Z")
    }, {
        "semanticId" : "782183b7c2ff33eeb283e9b23ba63934e904167a",
        "label" : "Vegan",
        "title" : "Veganism",
        "spot" : "vegan",
        "wp" : "http://en.wikipedia.org/wiki/Veganism",
        "confidence" : 0.85,
        "when" : new Date("2019-01-24T02:44:05.010Z")
    }, {
        "semanticId" : "782183b7c2ff33eeb283e9b23ba63934e904167a",
        "label" : "Meal",
        "title" : "Meal",
        "spot" : "meal",
        "wp" : "http://en.wikipedia.org/wiki/Meal",
        "confidence" : 0.72,
        "when" : new Date("2019-01-24T02:44:05.010Z")
    }, {
        "semanticId" : "782183b7c2ff33eeb283e9b23ba63934e904167a",
        "label" : "Protein",
        "title" : "Protein (nutrient)",
        "spot" : "protein",
        "wp" : "http://en.wikipedia.org/wiki/Protein_%28nutrient%29",
        "confidence" : 0.85,
        "when" : new Date("2019-01-24T02:44:05.010Z")
    }, {
        "semanticId" : "782183b7c2ff33eeb283e9b23ba63934e904167a",
        "label" : "Carbohydrate",
        "title" : "Carbohydrate",
        "spot" : "carbs",
        "wp" : "http://en.wikipedia.org/wiki/Carbohydrate",
        "confidence" : 0.74,
        "when" : new Date("2019-01-24T02:44:05.010Z")
    }, {
        "semanticId" : "782183b7c2ff33eeb283e9b23ba63934e904167a",
        "label" : "Lipid",
        "title" : "Lipid",
        "spot" : "fats",
        "wp" : "http://en.wikipedia.org/wiki/Lipid",
        "confidence" : 0.69,
        "when" : new Date("2019-01-24T02:44:05.010Z")
    }, {
        "semanticId" : "782183b7c2ff33eeb283e9b23ba63934e904167a",
        "label" : "Essential nutrient",
        "title" : "Essential nutrient",
        "spot" : "essential vitamins",
        "wp" : "http://en.wikipedia.org/wiki/Essential_nutrient",
        "confidence" : 0.74,
        "when" : new Date("2019-01-24T02:44:05.010Z")
    }, {
        "semanticId" : "782183b7c2ff33eeb283e9b23ba63934e904167a",
        "label" : "Mineral (nutrient)",
        "title" : "Mineral (nutrient)",
        "spot" : "minerals",
        "wp" : "http://en.wikipedia.org/wiki/Mineral_%28nutrient%29",
        "confidence" : 0.74,
        "when" : new Date("2019-01-24T02:44:05.010Z")
    }, /* this is the second semanticId */ {
        "semanticId" : "94bbc53fe4123a2367a8b7bb19bb3d8aaef8e3ae",
        "label" : "Music",
        "title" : "Music",
        "spot" : "music",
        "wp" : "http://en.wikipedia.org/wiki/Music",
        "confidence" : 0.63,
        "when" : new Date("2019-01-24T02:44:21.362Z")
    }, {
        "semanticId" : "94bbc53fe4123a2367a8b7bb19bb3d8aaef8e3ae",
        "label" : "Art",
        "title" : "Art",
        "spot" : "art",
        "wp" : "http://en.wikipedia.org/wiki/Art",
        "confidence" : 0.65,
        "when" : new Date("2019-01-24T02:44:21.362Z")
    }, {
        "semanticId" : "94bbc53fe4123a2367a8b7bb19bb3d8aaef8e3ae",
        "label" : "DIY",
        "title" : "Do it yourself",
        "spot" : "DIY",
        "wp" : "http://en.wikipedia.org/wiki/Do_it_yourself",
        "confidence" : 0.74,
        "when" : new Date("2019-01-24T02:44:21.362Z")
    }, {
        "semanticId" : "94bbc53fe4123a2367a8b7bb19bb3d8aaef8e3ae",
        "label" : "Supersonic",
        "title" : "Supersonic speed",
        "spot" : "Supersonic",
        "wp" : "http://en.wikipedia.org/wiki/Supersonic_speed",
        "confidence" : 0.65,
        "when" : new Date("2019-01-24T02:44:21.362Z")
    }],
    metadata: [{
        "linkedtime" : {
            "fblinktype" : "posts",
            "fblink" : "/supersonicfest/posts/2207339905983100",
            "postId" : "2207339905983100",
            "publisher" : "supersonicfest",
            "publicationTime" : new Date("2019-01-23T12:12:07.000Z")
        },
        "attributions" : [ 
            {
                "type" : "authorName",
                "display" : "Supersonic Festival",
                "content" : "Supersonic Festival",
                "fblink" : "https://www.facebook.com/supersonicfest/"
            }
        ],
        "texts" : [ 
            {
                "info" : "0-0",
                "text" : "'Absolutely no one makes music like the body... Equally at home on festival stages, art spaces, or in DIY basements, they transcend musical boundaries.'"
            }, 
            {
                "info" : "0-1",
                "text" : " You won't want to miss them at #Supersonic19..."
            }, 
            {
                "info" : "0-2",
                "text" : " WATCH >>> https://bit.ly/2MoWDQU TICKETS >>> https://bit.ly/2L2uQVs"
            }
        ],
        "commentable" : false,
        "externalLinks" : [ 
            {
                "link" : "https://bit.ly/2MoWDQU",
                "linked" : "https://bit.ly/2MoWDQU"
            }, 
            {
                "link" : "https://bit.ly/2L2uQVs",
                "linked" : "https://bit.ly/2L2uQVs"
            }, 
            {
                "link" : "https://www.youtube.com/watch?v=HNuzOkhBLjE",
                "linked" : "The Body - The Fall and the Guilt (Official Music Video)"
            }, 
            {
                "link" : "http://thrilljockey.com/products/no-one-deserves-happi",
                "linked" : "http://thrilljockey.com/products/no-one-deserves-happi"
            }
        ],
        "commentsLinks" : [],
        "id" : "4bcf2f98163ea99580709885c5ac1e2bba6ef7ea",
        "timelineId" : "6948ed036c9e4d4fda610b2177d61ae1bbea7b7f",
        "userId" : semantic_userId,
        "impressionOrder" : 31,
        "impressionTime" : new Date("2019-01-23T13:06:31.000Z"),
        "postCount" : {
            "personal" : 0,
            "global" : 0
        },
        "semanticId" : "94bbc53fe4123a2367a8b7bb19bb3d8aaef8e3ae",
        "semanticCount" : {
            "personal" : 0,
            "global" : 0
        },
        "semantic" : new Date("2019-01-24T02:44:21.362Z"),
        "dandelion" : {
            "fulltext" : "'Absolutely no one makes music like the body... Equally at home on festival stages, art spaces, or in DIY basements, they transcend musical boundaries.'.\n You won't want to miss them at #Supersonic19....\n WATCH >>> https://bit.ly/2MoWDQU TICKETS >>> https://bit.ly/2L2uQVs.\n",
            "indexes" : [ 
                0, 
                154, 
                204
            ]
        }
    }, {
        "linkedtime" : {
            "fblinktype" : "videos",
            "fblink" : "/Huel/videos/332926303985001/",
            "postId" : "332926303985001",
            "publisher" : "Huel",
            "publicationTime" : new Date("2019-01-23T00:00:06.000Z")
        },
        "attributions" : [
            {
                "type" : "authorName",
                "display" : "Huel",
                "content" : "Huel",
                "fblink" : "https://www.facebook.com/Huel/"
            }
        ],
        "texts" : [
            {
                "info" : "0-0",
                "text" : "No prep, no cooking and it contains a perfectly balanced, vegan meal with protein, carbs, fats and all 26 essential vitamins and minerals. "
            },
            {
                "info" : "0-1",
                "text" : " Too good to be true? Grab yours today."
            }
        ],
        "commentable" : false,
        "externalLinks" : [
            {
                "link" : "http://uk.huel.com/?utm_source=facebook",
                "linked" : "Shop NowHuel.com"
            },
            {
                "link" : "http://uk.huel.com/?utm_source=facebook",
                "linked" : "Shop NowHuel.com"
            },
            {
                "link" : "http://uk.huel.com/?utm_source=facebook",
                "linked" : "Shop Now"
            }
        ],
        "commentsLinks" : [],
        "id" : "232598611c1951a498903df62059e0225e849463",
        "timelineId" : "227d1a03e79016c3609a68e7eab9b49f936f602a",
        "userId" : semantic_userId,
        "impressionOrder" : 23,
        "impressionTime" : new Date("2019-01-23T14:34:53.000Z"),
        "postCount" : {
            "personal" : 0,
            "global" : 0
        },
        "semanticId" : "782183b7c2ff33eeb283e9b23ba63934e904167a",
        "semanticCount" : {
            "personal" : 0,
            "global" : 0
        },
        "semantic" : new Date("2019-01-24T02:44:05.010Z"),
        "dandelion" : {
            "fulltext" : "No prep, no cooking and it contains a perfectly balanced, vegan meal with protein, carbs, fats and all 26 essential vitamins and minerals. .\n Too good to be true? Grab yours today..\n",
            "indexes" : [
                0,
                141
            ]
        }
    }]
};

module.exports = {
    checkFixtures: checkFixtures,
    createFakeSemantics: createFakeSemantics,
    
    /* some spare data used in the tests */
    mockUserId: 1,
    mockPublicKey: "nothing special to see here",
    mockVersion: "0.0.T",
    mockExpectedPseudo: "beans-peas-couscous",

    /* this is a different pattern compareds to the one with dummy DB
     * and is used in test/testRSS.js */
    semanticMockUp: fake,
    labelsCheck: { filter: {
        semanticId: { "$in": semantic_Ids }
    },
        expected: 2
    },
    semanticsCheck: { filter: {
        semanticId: { "$in": semantic_Ids }
    },
        expected: 8 + 4,
    },
    metadataCheck: { filter: {
        userId: semantic_userId
    },
        expected: 2
    }
};
