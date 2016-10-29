# DRAFT: API v1 specification

The root for the API is `/api/v1`. All the endpoints starts from there.

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
  "postId": "<int>"
  "timestamp": "<Int> seconds since the Epoch>"
  "authorName": "<int>"
  "authorHref": "<int>"
}
```

#### Payload for a Private Impression
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
