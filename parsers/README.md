
# Keys

in order to execute these script, you need to have a JSON file in
this directory, named `parsers-keys.json` containing all the keys of the 
parser you run. (Keys has to be shared with the server), this is an example:

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

The key is associated to the parser name through the file name, the
library in lib/parse.js look for this explicitly and will fail.

open an issue in (facebook.tracking.exposed)[https://github.com/tracking-exposed/facebook] repository if you want develop a parser, and we'll start to manage keys distribution. You could write to claudio﹫tracking・exposed using [this PGP key](https://keybase.io/vecna).

## Environment 

some environment variables are checked by the parser library:

  * DEBUG: as usual by debug module
  * url: by default https://facebook.tracking.exposed
  * concurrency: numbers of snipped parsed in parallel (but node VM is single thread so I don't really know what happen), default 1
  * delay: milliseconds to wait after every parsing, default 200
  * since: the starting date by default is 2016-09-11
  * until: the end data of the window in analysis (to be tested?)
  * repeat: can be undefined, and by default you get only the HTMLs that are not yet been checked by the parser. can be `true`, and return all the objects in which previous parsing has been successfull, or `false` the object in which parser failed in the previous executions.


## The API and the parser...

are documented in the website via docco! (**TODO**)
