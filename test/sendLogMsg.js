var _ = require('lodash');
var debug = require('debug')('tests:sendLogMsg');
var nconf = require('nconf');

var echoes = require('../lib/echoes');

const id = Math.round((new Date()).getTime() / 1000);
const fieldValue = nconf.get('field') || "random-value-" + _.random(0, 0xffff);


function sendMessage() {
    debug("Sending message with `id` %s and `field` %s", id, fieldValue);

    echoes.addEcho("elasticsearch");
    echoes.setDefaultEcho("elasticsearch");

    var r = echoes.echo({
        id: id,
        index: "tester_sender",
        field: fieldValue
    });
    return r;
};

debug("The configuration of elastic is %j", nconf.get('elastic'));
return sendMessage();
