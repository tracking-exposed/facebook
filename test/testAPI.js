const expect  = require("chai").expect;

const _ = require('lodash');
const Promise = require('bluebird');
const debug = require('debug')('test:API');
const nconf = require('nconf');
const moment = require('moment');

const contentAPI = require('../lib/contentAPI');
const various = require('../lib/various');

nconf.argv().env().file({ file: 'config/unitTest.json' });
const endpoint = nconf.get('endpoint');

function resolveVariables(varname) {
  /* APIs have path such as /api/v2/personal/:userToken/ ...
   * if something begin with ":" it is a variable and this 
   * function resolve this */

  if(_.endsWith(varname, '?'))
    return '';

  if(_.startsWith(varname, ':')) {
    let provided = nconf.get(varname.substr(1));
    if(!provided) {
      debug("missing of variable %s, returning `dummy`", varname.substr(1));
      return 'dummy';
    }
    return provided;
  }
  return varname;
};

function doTheTest(api) {
 
  const x = _.join(_.map(_.split(api.route, '/'), resolveVariables), '/');

  it(`testing ${api.desc}`, function() {
    const url = `http://${endpoint}${x}`;
    return various
      .loadJSONurl(url)
      .tap(function(got) {
        expect(got).is.an.instanceOf(Object);
      })
      .catch(function(error) {
        debug("E %s %s: %s", api.desc, url, error.message);
      });
  });
}

describe(`Testing API in \`endpoint\` ${endpoint}`, function() {
  _.each(contentAPI, doTheTest);
});


