## system 

You require, to setup (the last command works only if you get a dump from the db)

```
npm install
npm run build 
mongorestore dump/
```

To develop and test 

```
brew services start mongodb
development=true npm run content
```

## files

This directory is `section/personal`, you can find in `section/personal/index.pug` the rendered page when you access to the personal page for the adopters.

This access is possible only with a valid token:
https://facebook.tracking.exposed/api/v1/summary/TOKENTOKENTOKEN

The script `summary.js` is located in `section/webscripts/summary.js`
