const express = require('express');
const app = express();
const server = require('http').Server(app);
const _ = require('lodash');
const moment = require('moment');
const bodyParser = require('body-parser');
const Promise = require('bluebird');
const debug = require('debug')('fbtrex:content');
const nconf = require('nconf');
const pug = require('pug');
const cors = require('cors');
const path = require('path');

/* this is the same struct of the previous version */
const utils = require('../lib/utils');
const mongo = require('../lib/mongo');
const common = require('../lib/common');

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

/* configuration for elasticsearch */
const echoes = require('../lib/echoes');
echoes.addEcho("elasticsearch");
echoes.setDefaultEcho("elasticsearch");

/* binding of express server */
server.listen(nconf.get('port'), nconf.get('interface'));
debug("Listening on http://%s:%s", nconf.get('interface'), nconf.get('port'));
/* configuration of express4 */
app.use(cors());
app.use(bodyParser.json({limit: '30kb'}));
app.use(bodyParser.urlencoded({limit: '30kb', extended: true}));

const getAPI = require('../lib/contentAPI');

_.each(getAPI, function(o) {
    debug("+API: %s %s", o.desc, o.route);
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
       console.log("mongodb is not running - check",cfgFile,"- quitting");
       process.exit(1);
    });
});
