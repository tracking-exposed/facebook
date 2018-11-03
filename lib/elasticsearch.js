var elasticsearch=require('elasticsearch');

function ElasticsearchClient(conf){
    this.hosts = conf["hosts"];
    this.client =  new elasticsearch.Client({  
	hosts: this.hosts
    });

    this.configuration = {
	originalConfiguration: conf, 
	defaultIndex: "fbtrex"
    }
}

ElasticsearchClient.prototype.sendDebug = function(objectFeed){
    this.client.index({  
	index: 'fbtrex',
	//  id: '', // TODO add timestamp id
	type: 'doc',
	body: objectFeed
    });
   
}

module.exports = ElasticsearchClient
