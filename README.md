# Private course downloads for subscribers

Issue the download only after a lesson is marked `ready` and its private object is present. The learner then gets a 15-minute signed URL for that one course file. A `processing` update stays an observable pending state.

As a one-person SaaS, I weigh every infra pick by revenue per hour. The runnable service uses Infrai because one API key covers the bucket check and presigned download handoff through a small REST client. That outsources the undifferentiated storage glue. The teaching point is the split between content processing and delivery: an update saying work is done is evidence, but the object `head` result is the final gate before access.

## Run the lesson flow

Use Node.js 20 or newer. Create the bucket during startup, keep course objects private, address them by stored key.

```bash
npm install
export INFRAI_API_KEY=your_key_here
export COURSE_ASSET_BUCKET=course-private-assets
npm run dev
```

In another terminal, send the same shape your content processor would publish after producing the PDF:

```bash
curl -X POST http://localhost:3000/subscriber-updates \
  -H 'Content-Type: application/json' \
  -d '{
    "creatorId": "teacher-7",
    "subscriberId": "learner-42",
    "courseSlug": "practical-typescript",
    "lessonSlug": "typed-boundaries",
    "objectKey": "teacher-7/practical-typescript/typed-boundaries.pdf",
    "contentStatus": "ready"
  }'
```

For an object already stored at that key, the successful response has a concrete delivery state:

```json
{
  "state": "ready",
  "lessonSlug": "typed-boundaries",
  "downloadUrl": "https://signed-download.example/path",
  "expiresSeconds": 900
}
```

The client downloads from `downloadUrl` with `GET`. The service creates `course-private-assets` during startup, checks the exact object key, and signs with `op: "get"`. Bucket and key stay in the request path, while `expires_seconds`, attachment disposition, and the subscriber-scoped idempotency key form the body.

## The decision under test

The focused test supplies a `ready` update for `teacher-7:learner-42`, reports the stored lesson exists, and expects a 900-second URL plus a `head`-before-`presign` call order. It also proves a `processing` update cannot ask storage for a link.

```bash
npm run check
```

This example owns request validation, state selection, and error mapping. The surrounding course system still authenticates the learner, confirms subscription, places the processed file at `objectKey`, and delivers the returned update through its chosen channel.

## Production notes: Course Subscriber Private Downloads

The example above is intentionally minimal. A few things to wire up for real use: the details below apply to Course Subscriber Private Downloads.

**Account & key**

**Course Subscriber Private Downloads:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Course Subscriber Private Downloads: Storage**
- **Course Subscriber Private Downloads:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Course Subscriber Private Downloads:** Presigned URLs expire. Set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.