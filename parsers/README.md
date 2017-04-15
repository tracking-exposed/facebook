# Dependencies

Note that these parsers depend on each others' work in sequence.

For example, no parsers working on "promoted" posttype can match anything before the parser _postType.js_ is run to analyze and mark the postTypes.

On adding new parsers, the dependency hierarchy should be recorded here for future reference.

Automatic resolving of dependencies should in the end be implemented.

# Keys

In order to execute these scripts you need to have a JSON file in
this directory, named `parsers-keys.json`: the library in `lib/parse.js` looks for this explicitly and will fail if the file cannot be found.

`parsers-keys.json` should contain all the keys of the
parser you run (keys have to be shared with the server). This is an example:

```
[
  {
    "key": "test-0-sdr43wdfguikjhgrtyyt43rtg",
    "name": "feedPostHref",
    "fields": ["feedPostHref"]
  },
  {
    "key": "test-1-dfghuytghjki87yhjki87yhjkiuy",
    "name": "postType",
    "fields": ["postType"]
  },
  {
    "key": "test-2-dghy654edfghy65rfgh",
    "name": "promotedInfo",
    "fields": ["ownerName","promotedInfo","promotedMedia","promotedPage"]
  }
]
```

Open an issue in [facebook.tracking.exposed](https://github.com/tracking-exposed/facebook) repository if you want develop a parser, and we'll start to manage keys distribution. You could write to claudio﹫tracking・exposed using [this PGP key](https://keybase.io/vecna).

## Environment

Some environment variables are checked by the parser library:

  * `concurrency`: numbers of snipped parsed in parallel (but node VM is single thread so I don't really know what happen), default `5`
  * `DEBUG`: as usual by debug module
  * `repeat`: can be undefined, and by default you get only the HTMLs that have not yet been checked by the parser. If `true`, return all the objects in which previous parsing has been successful. If `false`, return the object in which the parser failed during the previous executions.
  * `since`: the starting date by default is `2016-09-11`
  * `until`: the end data of the window in analysis (to be tested?)
  * `url`: by default https://facebook.tracking.exposed
  * `id`: overwrites all the other requirement, is supposed to be the htmls.id hash, used to request for a specific snippet

## easy reminder

p=`/bin/ls parsers/*.js`
for i in $p; do DEBUG=* url='http://localhost:8000' node $i; done


## The API and the parser...

### Commit the parser results

When the parser has operated, it has to commit a result in order to mark
the snippet already processed by the parser. Even if the parser hasn't
given back any answer the results have to be committed (so that they would be marked as processed).

*Endpoint*: `POST /snippet/result`

```
{
  "snippetId": "<hash of html snippet>",
  "parserName": "<string>",
  "parserKey": "<parserKey>",
  "result": "<metadata">
}
```
