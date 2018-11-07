// debugger module, suggested song: echoes pink floyd
var elasticsearchClient = require("./elasticsearch")
var Reflect = require("harmony-reflect")
var nconf = require('nconf')
var Promise = require('bluebird');

cfgFile = "config/settings.json";
nconf.argv().file({ file: cfgFile })

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
    this.debuggers[echoClient] = Reflect.construct(client, [clientConf])
    return client
};

Echoes.prototype.setDefaultEcho = function(echo){
    this.defaultEcho = this.debuggers[echo]
    return this.defaultEcho
}

Echoes.prototype.echo = function(data){

    if(this.defaultEcho == null){
	return null;
    }
    var defaultEcho = this.defaultEcho
    new Promise(function(afterAction) {
	var result = defaultEcho.sendDebug(data);
	if(afterAction != null){
	    afterAction(result);
	}
    });
    
}
module.exports = new Echoes(nconf.get("echoes"))
