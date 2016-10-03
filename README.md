# Facebook.Tracking.Exposed

[https://facebook.tracking.exposed](https://facebook.tracking.exposed)

## Install and run locally

**Note:** you need  to have `mongodb` on your machine in order to run the full project. If `mongodb` isn't active, the software will quit with an error at the first usage.

- Install project dependencies

```bash
$ sudo apt-get install mongodb
$ npm install
$ npm run build
$ npm run watch
```

At this point you should able to find your local version on your [localhost address (port 8000)](http://localhost:8000).

## Import the node data

Your server is empty, if you need mirror some data, import [the few](https://facebook.tracking.exposed/impact) collected so far:

```
$ DEBUG=* source='https://facebook.tracking.exposed' operations/importer.js
```

## Docker support

```
$ docker run -d --name mongo mongo
$ docker run -d --name fbtrex -p 8000:8000 --link mongo:mongo fbtrex npm run watch
```
The immage support the importer script:
```
$ docker run -d --name fbtrex -p 8000:8000 --link mongo:mongo fbtrex /bin/bash -c '$ docker run -d --name fbtrex -p 8000:8000 --link mongo:mongo fbtrex && npm run watch'

```

Is possible to simply build the fbtrex docker image with:
```
$ docker build -t fbtrex .
```
## UserScript

If you want debug, develop or investigate on the userScript, you've to add the line with 'localhost', because TamperMonkey don't permit arbitrary connections, you've to declare the connected hosts. This is in the [header of the UserScrpt](https://sourceforge.net/p/greasemonkey/wiki/Metadata_Block/)

    // @connect      facebook.tracking.exposed
    // @connect      localhost

Below in the code, change the line:

    url = 'https://facebook.tracking.exposed',

To:

    url = 'http://localhost:8000',

## API

The API currently are undocumented, but the best way to seem them run is with the command:

```$ DEBUG=* url='https://localhost:8000' operations/tryAPI.js```
