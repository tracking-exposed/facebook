#!/usr/bin/env bash

rm -rf ./dist
NODE_ENV=production webpack -p
cp manifest.json ./dist
chromium-browser --pack-extension=./dist --pack-extension-key=~/.ssh/chrome-store.pem

