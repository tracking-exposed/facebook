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

  if(_.startsWith(varname, ':'))
    return nconf.get(varname.substr(1));
    
  return varname;
};

function doTheTest(api) {
 
  const x = _.join(_.map(_.split(api.route, '/'), resolveVariables), '/');
  console.log(x);

  it(`testing ${api.desc}`, function() {
    const url = 'http://' + endpoint + x;
    debug("%s", url);
    return various
      .loadJSONurl(url)
      .tap(function(got) {
        expect(got).is.an.instanceOf(Object);
      });
  });
}

describe(`testing API in \`endpoint\` ${endpoint}`, function() {

  _.each(contentAPI, doTheTest);

});


