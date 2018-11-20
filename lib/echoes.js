// debugger module, suggested song: echoes pink floyd
var elasticsearchClient = require("./elasticsearch")
var debug = require('debug')('lib:echos');
var Reflect = require("harmony-reflect")
var nconf = require('nconf')
var Promise = require('bluebird');

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

    var defaultEcho = this.defaultEcho
    new Promise(function(afterAction) {
        var result = defaultEcho.sendDebug(data);
        if(afterAction != null)
            afterAction(result);
    })
    .catch(function(error) {
        debug("Error managed in echo [ elastic=%s can turn it off ]", DISABLESTR);
        debug(error);
    });
}

module.exports = new Echoes({
    elasticsearch: { 
        hosts : [ nconf.get("elastic") ]
    },
});
