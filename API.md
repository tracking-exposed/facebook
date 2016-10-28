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
    "location": "window.location String"
}
```

Note: server side the `id` is `sha1(currentUserId + timelineId)`.

#### Payload for a Public Post
```
{
    "type": "post",
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

#### Payload for a Private Post
```
{
    "type": "post",
    "visibility": "private",
    "impressionTime": "<ISO8601 DateTime>",
    "impressionOrder": "<int>",
    "timelineId": "<UUID>"
}
```

Note, server side:
 - the `id` is `sha1(currentUserId + timelineId + impressionOrder)`.
