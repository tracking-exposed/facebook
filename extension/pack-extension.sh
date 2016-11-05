#!/usr/bin/env bash

rm -rf ./dist
NODE_ENV=production node_modules/.bin/webpack -p
cp manifest.json icons/* ./dist
chromium-browser --pack-extension=./dist --pack-extension-key=~/.ssh/chrome-store.pem

