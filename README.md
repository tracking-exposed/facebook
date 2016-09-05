# Facebook.Tracking.Exposed

[https://facebook.tracking.exposed](https://facebook.tracking.exposed)

## Compile and run

**Note:** you need  to have `mongodb` on your machine in order to run the full project.

- Install project dependencies

```bash
$ npm install
$ npm run build
$ npm run watch
```

At this point you should able to find your local version on your localhost address (port 8000).

## API

For example:

    http /user/public/2/TL/100005961541729/8
    http /user/public/2/TLCSV/100005961541729/10

The last number is the amount of refresh to take in the past, use 0
