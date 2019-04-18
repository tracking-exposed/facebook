const expect    = require("chai").expect;
const nconf = require('nconf');
const moment = require('moment');
const _ = require('lodash');
const debug = require('debug')('test:lib:parse');

const mongo = require('../../lib/mongo');

nconf.argv().env().file({ file: 'config/content.json' });

describe('test the pipeline functions', function() {

    const mongoHost = nconf.get('mongoHost');
    const mongoPort = nconf.get('mongoPort');
    const mongoDb = 'test'; 

    const mongoUri = `mongodb://${mongoHost}:${mongoPort}/${mongoDb}`;
        // const mongoc = await mongo.clientConnect({uri: mongoUri});
        // await mongoc.close();

    it("test checkMetadata", async function() {
        checkMetadata: checkMetadata,
    });

    it("test initialize", async function() {: initialize,
        initialize: initialize,

    });
    it("test mergeHTMLImpression", async function() {: mergeHTMLImpression,
        mergeHTMLImpression: mergeHTMLImpression,
        
    });
    it("test finalize", async function() {: finalize,
        finalize: finalize,
        
    });
    it("test logSummary", async function() {: logSummary,
        logSummary: logSummary,
        
    });
    it("test save", async function() {: save,
        save: save,
        
    });
    it("test postIdCount", async function() {: postIdCount,
        postIdCount: postIdCount,
        
    });
    it("test semanticIdCount", async function() {: semanticIdCount,
        semanticIdCount: semanticIdCount,
        
    });
    it("test mark", async function() {: mark,
        mark: mark,
        
    });
    it("test parseHTML", async function() {: parseHTML,
        parseHTML: parseHTML,
    });

});
