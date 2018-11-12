#!/bin/sh

set -xe

docker-compose  -d
echo "wait for docker coming up"
sleep 60
sh support/elasticsearch/setup.sh
