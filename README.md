# Facebook.Tracking.Exposed

Take a look at the [website](https://facebook.tracking.exposed), install the chrome the [chrome extension](https://chrome.google.com/webstore/detail/facebooktrackingexposed/fnknflppefckhjhecbfigfhlcbmcnmmi?hl=en) or drop a comment in [HW](https://news.ycombinator.com/item?id=13161725).


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
Install docker and docker-compose on your local machine
```
$ docker-compose up
```


# TREX, Contribution Code of Conduct

TODO Contribution logic follow up with igni

## Be friendly and patient

We understand that everyone has different levels of experience or knowledge in many diverse fields, be it technical or
non-technical in nature. We also have areas of knowledge we are eager to expand; we want to be a community where people
can not only contribute, but feel comfortable to ask questions as well and learn along the way. If someone says something
wrong, or says something accidentally offensive, respond with patience and try to keep it polite and civil. Remember that
we all were newbies at one point.

## Be welcoming

We strive to be a community that welcomes and supports people of all backgrounds and identities.
**Everyone**, like you, if someone join here is to work on [tracking.exposed](https://tracking.exposed), This is what you have in common, please stay focus on that rather than any cultural, religious, psycological, behavioral differencies.

## Be considerate

Your work will be used by other people, and you in turn will depend on the work of others. Any decision you make will affect
users and colleagues, and you should take those consequences into account when making decisions. Remember that we’re a world-wide
community, so you might not be communicating in someone else’s primary language.

## Be respectful

Not all of us will agree all the time, but disagreement is no excuse for poor behavior and poor manners. We might all
experience some frustration now and then, but we cannot allow that frustration to turn into a personal attack. It’s important
to remember that a community where people feel uncomfortable or threatened is not a productive one. Members of the JS Foundation
community should be respectful when dealing with other members as well as with people outside the JS Foundation community.

## Be careful in the words that you choose

We are a community of professionals, and we conduct ourselves professionally. Be kind to others. Do not insult or put
down other participants. Harassment and other exclusionary behavior aren’t acceptable. This includes, but is not limited to:

* Violent threats or language directed against another person.
* Discriminatory jokes and language.
* Posting sexually explicit or violent material.
* Posting (or threatening to post) other people’s personally identifying information (“doxing”).
* Personal insults, especially those using racist or sexist terms.
* Unwelcome sexual attention.
* Advocating for, or encouraging, any of the above behavior.
* Repeated harassment of others. In general, if someone asks you to stop, then stop.

## When we disagree, try to understand why

Disagreements, both social and technical, happen all the time and JS Foundation projects are no exception. It is important
that we resolve disagreements and differing views constructively. Remember that we’re different. The strength of the JS
Foundation comes from its varied community, people from a wide range of backgrounds. Different people have different
perspectives on issues. Being unable to understand why someone holds a viewpoint doesn’t mean that they’re wrong. Don’t
forget that it is human to err and blaming each other doesn’t get us anywhere. Instead, focus on helping to resolve issues
and learning from mistakes.

Original text courtesy of the Speak Up! project and Django Project (and tracking.exposed cribbed from [Mocha](https://github.com/mochajs/mocha/blob/master/.github/CODE_OF_CONDUCT.md))

## QUESTIONS?

If you have questions, please see the FAQ. If that doesn’t answer your questions, feel free to email conduct@js.foundation.
