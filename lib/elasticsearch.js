var elasticsearch=require('elasticsearch');

function ElasticsearchClient(hosts){

    this.hosts = hosts;
    this.client =  new elasticsearch.Client({  
	hosts: hosts
    });

    this.configuration = {
    defaultIndex: "fbtrex"

}

}

function sendDebug(objectFeed){
client.index({  
  index: 'fbtrex',
//  id: '', // TODO add timestamp id
  type: 'doc',
  body: objectFeed
});

}

module.exports = {
    sendDebug: sendDebug
}
