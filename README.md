# Facebook.Tracking.Exposed

[https://facebook.tracking.exposed](https://facebook.tracking.exposed)

# Important Note

  we're in transition phases, as you can see, this is the graph of the post received by **type**:

  ![alt tag](https://facebook.tracking.exposed/images/posttype-alpha.png)

so, the entire system used in the α release result broken, but this is OK in the project point of view:

  * a team has been created
  * privacy problems arise and has been discussed, creating a privacy model for the ß release
  * a new technical approach to collect facebook's impressions has been developed [experimental chrome extension](https://chrome.google.com/webstore/detail/facebooktrackingexposed/kbeabbonbnjinbemmjgpdccmfnifokgc)
  * a new approach to develop distributed **parsers** 

We can just say: stay tuned!

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
First, you need to install a mongodb docker image and run it as the basic dataset of your installation:
```
$ docker run -d --name mongo mongo
```
note: this container will maintain the dataset on your local machine, in order to restore it you have to simply start the container:
```
$ docker start mongo
```

If you need to start the node with an empty dataset, run:
```
$ docker run -d --name fbtrex -p 8000:8000 --link mongo:mongo fbtrex/fbtrex-app npm run watch
```
note: if the image is not present in your local docker registry will be automatic pulled from the docker hub.

Or if you need your instance filled with and synced with the main node, run:
```
$ docker run -d --name fbtrex -p 8000:8000 --link mongo:mongo fbtrex/fbtrex-app /bin/bash -c "DEBUG=* source='https://facebook.tracking.exposed' operations/importer.js && npm run watch"
```

If you want to build on your own the image:
```
$ docker build -t fbtrex .
```

