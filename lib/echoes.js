// debugger module, suggested song: echoes pink floyd
var elasticsearchClient = require("./elasticsearch")
var nconf = require('nconf')

cfgFile = "config/settings.json";
nconf.argv()
     .file({ file: cfgFile })

function Echoes(configuration){
    this.configuration = configuration
    this.debuggers = {}
    this.defaultEcho = null;
}

function getEchoClient(client){
    return {"elasticsearch": elasticsearchClient}[client];
}

Echoes.prototype.addEcho = function(echoClient){
    var client =  new getEchoClient(echoClient)(configuration[echoclient])
    this.debuggers[echoClient] = client
    return client
};

Echoes.prototype.setDefaultEcho = function(echo){
    this.defaultEcho = this.debuggers[echo]
}

Echoes.prototype.echo = function(data){

    if(this.defaultEcho == null){
	return null;
    }

    this.defaultEcho.sendDebug(data);
}

module.exports = Echoes(nconf.get("echoes"))
