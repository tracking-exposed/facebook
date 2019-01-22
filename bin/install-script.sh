#!/bin/sh

rm -rf ./dist

V=dist/js/ 
mkdir -p dist/css && 
mkdir -p dist/js/local 
mkdir -p dist/images 
mkdir -p $V 

echo "User-agent: *\nAllow: /\nDisallow: /personal/\n" >> dist/robots.txt

node_modules/.bin/stylus styles/index.styl -o dist/css
node_modules/.bin/stylus styles/pages.styl -o dist/css
node_modules/.bin/stylus styles/personal.styl -o dist/css
node_modules/.bin/stylus styles/summary.styl -o dist/css

cp styles/favicon.ico dist/
cp -r sections/images/* dist/images
cp -r sections/webscripts/* dist/js/local/ 
cp -r node_modules/bootstrap/dist/* dist/
cp -r support/tampermonkey/autoscroll.user.js dist/
cp html/* dist/

cp ./node_modules/bootstrap/js/collapse.js $V
cp node_modules/jquery/dist/jquery.js $V 
cp node_modules/d3/d3.min.js $V 
cp node_modules/c3/c3.min.js $V 
cp node_modules/moment/min/moment.min.js $V 
cp node_modules/c3/c3.css dist/css && 
cp node_modules/lodash/lodash.min.js $V 

cp node_modules/reveal.js/js/reveal.js $V 
cp node_modules/reveal.js/css/theme/solarized.css dist/css/reveal-solarized.css 
cp node_modules/reveal.js/css/reveal.css dist/css/reveal.css 
cp node_modules/reveal.js/lib/js/head.min.js $V/reveal-head.min.js 
cp node_modules/reveal.js/js/reveal.js $V/reveal.min.js 
cp node_modules/reveal.js/lib/js/classList.js $V/classList.js 
cp node_modules/reveal.js/lib/font/league-gothic/* dist/css/ 
cd $V
wget https://unpkg.com/isotope-layout@3/dist/isotope.pkgd.min.js 
cd ../..
