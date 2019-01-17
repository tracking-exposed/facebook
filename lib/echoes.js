// debugger module, suggested song: echoes pink floyd
const _ = require('lodash');
const debug = require('debug')('lib:echoes');
const Reflect = require("harmony-reflect")
const nconf = require('nconf')
const Promise = require('bluebird');

const elasticsearchClient = require("./elasticsearch")
const utils = require('./utils');

const DISABLESTR = "disabled";
const cfgFile = "config/collector.json";
nconf.env().argv().file({ file: cfgFile })

function Echoes(configuration){
    this.configuration = configuration
    this.debuggers = {}
    this.defaultEcho = null;
}

Echoes.prototype.getEchoClient = function(client){
    return {"elasticsearch": elasticsearchClient}[client];
}
Echoes.prototype.addEcho = function(echoClient){
    var clientConf = this.configuration[echoClient]
    var client =  this.getEchoClient(echoClient)
    try {
        this.debuggers[echoClient] = Reflect.construct(client, [clientConf])
    } catch(error) {
        debug("Error managed in addEcho [ elastic=%s can turn it off ]", DISABLESTR);
        debug(error);
    }
    return client
}
Echoes.prototype.setDefaultEcho = function(echo){
    this.defaultEcho = this.debuggers[echo]
    return this.defaultEcho
}
Echoes.prototype.echo = function(data){

    if(nconf.get('elastic') === DISABLESTR)
        return null;

    if(this.defaultEcho == null)
        return null;

    /* for each log entry, is computed an unique ID and the date time `when` is addedd too */
    data.when = new Date();
    data.id = _.parseInt(Date.now() + "" + _.random(10000, 99999));
    debug("ES logging ID %d in [%s]", data.id, data.index);

    var defaultEcho = this.defaultEcho;
    new Promise(function(afterAction) {
        var result = defaultEcho.sendDebug(data);
        if(afterAction != null)
            afterAction(result);
    })
    .catch(function(error) {
        debug(error);
        debug("Error catch [ use elastic=%s to turn it off ]", DISABLESTR);
    });
}

module.exports = new Echoes({
    elasticsearch: { 
        hosts : [ nconf.get("elastic") ]
    },
});
