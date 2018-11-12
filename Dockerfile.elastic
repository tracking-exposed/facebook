FROM docker.elastic.co/elasticsearch/elasticsearch:6.4.2
COPY support /support
USER elasticsearch
ENV ES_JAVA_OPTS="-Xms64m -Xmx64m"
ENTRYPOINT "elasticsearch"
