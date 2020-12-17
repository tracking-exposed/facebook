const express = require('express');
const app = express();
const server = require('http').Server(app);
const _ = require('lodash');
const bodyParser = require('body-parser');
const Promise = require('bluebird');
const debug = require('debug')('fbtrex:content');
const nconf = require('nconf');
const cors = require('cors');

/* this is the same struct of the previous version */
const mongo = require('../lib/mongo');
const common = require('../lib/common');
const security = require('../lib/security');

var cfgFile = "config/content.json";
nconf.argv().env().file({ file: cfgFile })

if(nconf.get('FBTREX') !== 'production') {
    debug("Because $FBTREX is not 'production', it is assumed be 'development'");
    nconf.stores.env.readOnly = false;
    nconf.set('FBTREX', 'development');
    nconf.stores.env.readOnly = true;
} else {
    debug("Production execution!");
}

debug("configuration file: %s | FBTREX mode [%s]", cfgFile, nconf.get('FBTREX'));

if(!nconf.get('interface') || !nconf.get('port') ||  !nconf.get('schema') ) {
    console.log("Missing configuration essential (interface, post, schema)");
    process.exit(1);
}

/* binding of express server */
server.listen(nconf.get('port'), nconf.get('interface'));
debug("Listening on http://%s:%s", nconf.get('interface'), nconf.get('port'));
/* configuration of express4 */
app.use(cors());
app.use(bodyParser.json({limit: '30kb'}));
app.use(bodyParser.urlencoded({limit: '30kb', extended: true}));

const getAPI = require('../lib/contentAPI');

_.each(getAPI, function(o) {
    debug("+registering API: %s %s", o.desc, o.route);
    app.get(o.route, function(req, res) {
        return common.serveRequest(o.desc, o.func, req, res);
    });
});

Promise.resolve().then(function() {
  return mongo
    .count(nconf.get('schema').supporters)
    .then(function(amount) {
       debug("mongodb is running, found %d supporters", amount);
    })
    .catch(function(error) {
        console.log("mongodb is not accessible: check", cfgFile, error.message);
        process.exit(1);
    });
});

security.checkKeyIsSet();
