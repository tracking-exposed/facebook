# API v1 specification

The root for the API is `/api/v1`. All the endpoints starts from there.

# API: Extensions to server

The following specification are implemented in the browser extension
monitoring the Facebook feed and the server receiving the data

## Headers
```
Content-Type: application/json
X-Fbtrex-Userid: <currentUserID>
X-Fbtrex-Version: <currentVersion>
X-Fbtrex-Build: <currentBuild>
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

#### Payload for a Public Impression
```
{
    "visibility": "public",
    "impressionTime": "<ISO8601 DateTime>",
    "impressionOrder": "<int>",
    "timelineId": "<UUID>",
    "html": "<html snippet>",
    "metadata": "<List>"
}
```

Note, server side:
 - the `id` is `sha1(currentUserId + timelineId + impressionOrder)`.
 - `htmlId` is `sha1(html snippet)`

Note, metata is a list of objects, each of them corrispond to an extracted
meta-data from the post.

The few implemented, and optionally present, metadata are:

```
{
  "postType": "feed|promoted"
  "timestamp": "<Int> seconds since the Epoch>"
  "postHref": "<str>"
  "authorName": "<str>"
  "authorHref": "<str>"
}
```

#### Payload for a Private Impression

We mean for Private Impression, the post with a **restricted audience**, only you, friend, or custom list.

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

The following specification are implemented in the server and
in the components executing the parsing and analysis of the posts.

The following API are intended to distribute the effort of HTML
parsing, data extraction and data mining.

## Parser identification

every parser performing the request has a key (provided by the server).
A key identify a specific parser.

A parser is intended to extract a specific content from the HTML snippet.

For example: a parser extracting the author info (name and facebook Id) is
is different from a parser extracting the previwe image display.

The key is a string of 20 chars in base58, random bytes, and take name of
`parserKey` in this specification.

### Get available HTML snippet

*Endpoint*: `POST /snippet/status`

```
{
  "since": "<ISO8601 DateTime>",
  "to": "<ISO8601 DateTime>",
  "parserKey": "<parserKey>"
}
```

The server checks the stored HTML pieces in the requested time range and
answers:

```
{
  "available": "<Int>",
  "parsed": "<Int>"
}
```

The endpoint `status` is intende to get numbers and permit to the server
a proper estimation of resources to be used to deal with the available
data.

### Get HTML snippet

*Endpoint*: `POST /snippet/content`


```
{
  "since": "<ISO8601 DateTime>",
  "to": "<ISO8601 DateTime>",
  "parserKey": "<parserKey>",
  "repeat": "<bool>",
  "amount": "<Int>"
}
```

The server checks the stored HTML pieces in the requested time range,
and return the `amount` requested.

if `repeat` is false, only HTML snippet not yet parsed by `parserKey`
are considered, if `repeat` is true, `parserKey` is ignored. The 
answer contains the list of snippet, identify by a snippetId:

```
{
  "snippets": [
    {
      "html": "<html snippet>",
      "snippetId": "<hash of html snippet>"
    },
    { .. }
  ]
}
```

### Commit the parser results

When the parser has operated, has to commit a result in order to mark
the snippet already processed by the parser, also if the parser hasn't 
give back any answer the results has to be committed (so would be marked
as processed)

*Endpoint*: `POST /snippet/result`

```
{
  "snippetId": "<hash of html snippet>",
  "parserKey": "<parserKey>",
  "result": "<Metadata">
}
```
