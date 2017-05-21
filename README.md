# Facebook.Tracking.Exposed

Take a look at the [website](https://facebook.tracking.exposed), install the chrome the [chrome extension](https://chrome.google.com/webstore/detail/facebooktrackingexposed/fnknflppefckhjhecbfigfhlcbmcnmmi?hl=en) or drop a comment in [HW](https://news.ycombinator.com/item?id=13161725).

## Todo List
- [ ] improve the docs

## Contribute
- Look at how to [run it locally](https://github.com/tracking-exposed/facebook#run-it-locally)
- Write a parser
- Write web interfaces
- Design new analysis
- More? It's open! just fork it!

## Architecture
The project is designed to serve open data and distributed analysis of the data obtained from the users.

- The server  stores the user's data that receives raw from the [ extension](https://github.com/tracking-exposed/web-extension).
- The parsers extract metadata from the html snippets, some parsers are executed on the server ([here](https://github.com/tracking-exposed/facebook/tree/master/parsers)) or remotely trough [parser api]().
- The data are exposed through [api](https://github.com/tracking-exposed/facebook/blob/master/API.md) and web interfaces like [reality check](https://facebook.tracking.exposed/realitycheck/100013962451936/data) and [reality meter](https://facebook.tracking.exposed/realitymeter/100013962451936).

## Api
*Endpoint*: https://facebook.tracking.exposed/api/v1

### Get available HTML snippet

`POST /snippet/status`

```
{
  "since": "<ISO8601 DateTime>",
  "until": "<ISO8601 DateTime>",
  "parserName": "<string>",
  "requirements": "<object>"
}
```

*For example, if your parser is analyzing promoted posts, received in the last 48 hours:*
```
{
  "requirements": { "postType" : true, Type:"feed" },
  "since": "2016-11-08T21:15:13.511Z",
  "until": "2016-11-10T21:15:13.516Z",
  "parserName": "postType",
}
```

The server checks the stored HTML pieces in the requested time range and
answers:

```
{
  "available": "<Int>",
  "limit": "<Int>"
}
```

The server checks the stored HTML pieces in the requested time range. It then
returns the number of `available` HTML snippets that do not yet have a key named
`parserName`, and the maximum amount of HTML snippets that would be
returned when the endpoint content (below) is invoked.

### Get HTML snippet

`POST /snippet/content`

Request:
```
{
  "since": "<ISO8601 DateTime>",
  "until": "<ISO8601 DateTime>",
  "parserName": "<string>",
  "requirements": "<object>"
}
```

The request is the same as the previous.

Answer:
```
[
  {
    "html": "<html snippet>",
    "metadata-1": "<value>",
    "metadata-2": "<value>",
    "snippetId": "<hash of html snippet>"
    },
],
```

is a list of objects, each one containing the HTML section, the id, writingTime, and the previously added metadata.

## Run it locally

You need  to have `mongodb` on your machine in order to run the full project.

```bash
$ sudo apt-get install mongodb
$ npm install
$ npm run build
$ npm run watch
```

At this point you should able to find your local version on your [localhost address (port 8000)](http://localhost:8000).

Your server is empty, don't expect that connecting at localhost will show you something.
You might mirror the public section of the database (TODO) and use it ad working data to develop new API/visualisation

### Debug mode
```bash
DEBUG=* node app
```

### Docker support
First, you need to install a mongodb docker image and run it as the basic dataset of your installation:
```
$ docker run -d --name mongo mongo
$ docker run -d --name fbtrex -p 8000:8000 --link mongo:mongo fbtrex/fbtrex-app
```
