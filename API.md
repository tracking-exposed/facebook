# API v1 specification

The root for the API is `/api/v1`. All the endpoints start from there.

# API: Extensions to server

The following specifications are implemented in the browser extension
monitoring, the Facebook feed and the server receiving the data.

## Headers
```
Content-Type: application/json
X-Fbtrex-Userid: <currentUserID>
X-Fbtrex-Version: <currentVersion>
X-Fbtrex-Build: <currentBuild>
X-Fbtrex-Publickey: <string>
X-Fbtrex-Signature: <string>
```

### Post Events
*Endpoint*: `POST /events`

#### Payload for a Timeline
```
{
    "type": "timeline",
    "id": "<UUID>",
    "startTime": "<ISO8601 DateTime>",
    "location": "feed|other"
}
```

Note: server side the `id` is `sha1(currentUserId + timelineId)`.

Navigation outside the main feed (pages, friends, followed users) is
ignored, but it is kept track of the fact that the user is still active on Facebook.

#### Payload for a Public Impression
```
{
    "visibility": "public",
    "impressionTime": "<ISO8601 DateTime>",
    "impressionOrder": "<int>",
    "timelineId": "<UUID>",
    "html": "<html snippet>"
}
```

Note, server side:
 - the `id` is `sha1(currentUserId + timelineId + impressionOrder)`.
 - `htmlId` is `sha1(html snippet)`

#### Payload for a Private Impression

For *Private Impression* we mean the post with a **restricted audience** (e.g. only you, your friends, or a custom list).

```
{
  "type": "feed",
  "visibility": "private",
  "impressionTime": "<ISO8601 DateTime>",
  "impressionOrder": "<int>",
  "timelineId": "<UUID>"
}
```

Note, server side:
 - the `id` is `sha1(currentUserId + timelineId + impressionOrder)`.

# API: Server to parsers

The following specifications are implemented in the server and in the
components executing parsing and analysis of posts.

The following APIs are intended to distribute the effort of HTML parsing,
data extraction and data mining.

## Parser identification

Every parser performing the request has a key (provided by the server) and a name. The key is secret, and authenticates the specific parser.

A parser is intended to extract a specific content from the HTML snippet.

*For example: a parser extracting the author info (name and userId) is different from a parser extracting the preview image display, and they
would have self explanatory names like 'imagePreview' and 'authorInfo'.*

The key is a string of 20 chars in base58, random bytes, and take name of
`parserKey` in this specification.

### Get available HTML snippet

*Endpoint*: `POST /snippet/status`

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
  "requirements": { "postType" : "promoted " },
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

*Endpoint*: `POST /snippet/content`

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
