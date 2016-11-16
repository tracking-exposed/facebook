
# Keys

in order to execute these script, you need to have a JSON file in
this directory with the same name of the script + "-key.json"

postType.js needs a postType-key.json looking like this:

```
{
  "key": "TESTtestTESTtestTEST-1"
}
```

The key is associated to the parser name through the file name, the
library in lib/parse.js look for this explicitly and will fail.

open an issue in (facebook.tracking.exposed)[https://github.com/tracking-exposed/facebook] repository if you want develop a parser, and we'll start to manage keys distribution. You can use claudio﹫tracking・exposed and [this PGP key](https://keybase.io/vecna) for encrypted communication.

## Environment 

some environment variables are checked by the parser library:

  * DEBUG: as usual by debug module
  * url: by default https://facebook.tracking.exposed
  * concurrency: numbers of snipped parsed in parallel (but node VM is single thread so I don't really know what happen), default 1
  * delay: milliseconds to wait after every parsing, default 200
  * since: the starting date by default is 2016-09-11
  * until: the end data of the window in analysis

