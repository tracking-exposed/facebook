const assert = require('assert');
var ElasticsearchClient = require('./../lib/elasticsearch');
describe('elasticsearch log data', function(){

    it('should setup elastic search find', function(){
	conf = {"hosts": ["localhost:9200"]};
	elasticsearchClient = new ElasticsearchClient(conf)
	let confTest = {"originalConfiguration": conf, "defaultIndex": "fbtrex"}
	assert.equal(elasticsearchClient.configuration.originalConfiguration, confTest.originalConfiguration)
	assert.equal(elasticsearchClient.configuration.defaultIndex, confTest.defaultIndex)
    });

})
