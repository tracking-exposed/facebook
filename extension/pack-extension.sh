#!/usr/bin/env bash

rm -rf ./dist
NODE_ENV=production node_modules/.bin/webpack -p
cp manifest.json icons/* ./dist
cd ./dist
zip extension.zip *

