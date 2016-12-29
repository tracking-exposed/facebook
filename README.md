# Facebook.Tracking.Exposed

[https://facebook.tracking.exposed](https://facebook.tracking.exposed), take a look in the website, or drop a comment in [HW](https://news.ycombinator.com/item?id=13161725).

## Install and run locally

You need  to have `mongodb` on your machine in order to run the full project. 

- Install project dependencies

```bash
$ sudo apt-get install mongodb
$ npm install
$ npm run build
$ npm run watch
```

At this point you should able to find your local version on your [localhost address (port 8000)](http://localhost:8000).

Your server is empty, don't expect that connecting at localhost will show you something. 
You might mirror the public section of the database (TODO) and use it ad working data to develop new API/visualisation

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
$ docker run -d --name fbtrex -p 8000:8000 --link mongo:mongo fbtrex/fbtrex-app /bin/bash -c "DEBUG=* source='https://facebook.tracking.exposed' echo 'DB MIRRORING NOT IMPLEMENTED YET' && npm run watch"
```

If you want to build on your own the image:
```
$ docker build -t fbtrex .
```

