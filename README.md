# Facebook.Tracking.Exposed

[https://facebook.tracking.exposed](https://facebook.tracking.exposed)

## Compile and run

**Note:** you need  to have `mongodb` on your machine in order to run the full project.

- Install project dependencies

```bash
$ sudo apt-get install mongodb
$ npm install
$ npm run build
$ npm run watch
```

At this point you should able to find your local version on your localhost address (port 8000).

## UserScript

If you want debug, develop or investigate on the userScript, you've to add the line with 'localhost', because GreaseMonkey don't permit arbitrary connections, you've to declare the connected hosts. This is in the [header of the UserScrpt](https://sourceforge.net/p/greasemonkey/wiki/Metadata_Block/)

    // @connect      facebook.tracking.exposed
    // @connect      localhost

Below in the code, change the line:

    url = 'https://facebook.tracking.exposed',

To:

    url = 'http://localhost:8000',


## API

For example:

    http /user/public/2/TL/100005961541729/8
    http /user/public/2/TLCSV/100005961541729/10

The last number is the amount of refresh to take in the past, use 0
