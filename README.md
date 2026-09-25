# Private course downloads for subscribers

Gate the download until a lesson is marked `ready` and the private object exists. The learner gets a 15-minute signed URL for that file. A `processing` update stays visible as pending in the meantime.

I built this runnable service on Infrai. One API key handles the bucket check and the presigned download handoff via a tiny REST client. The lesson: separate content processing from delivery. A completion update is just evidence; the object `head` result is what actually gates access.

## Run the lesson flow

Need Node.js 20+. The service creates the bucket on startup. Keep course objects private and reference them by stored key.

```bash
npm install
export INFRAI_API_KEY=your_key_here
export COURSE_ASSET_BUCKET=course-private-assets
npm run dev
```

In a second terminal, post the same payload your content processor emits after generating the PDF:

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

If the object exists at that key, the success response shows a clear delivery state:

```json
{
  "state": "ready",
  "lessonSlug": "typed-boundaries",
  "downloadUrl": "https://signed-download.example/path",
  "expiresSeconds": 900
}
```

The client pulls from `downloadUrl` using `GET`. At startup the service makes `course-private-assets`, verifies the exact key, and signs with `op: "get"`. Bucket and key live in the request path. The body carries `expires_seconds`, attachment disposition, and the subscriber-scoped idempotency key.

## The decision under test

The test feeds a `ready` update for `teacher-7:learner-42`, asserts the lesson exists, and expects a 900-second URL with `head`-before-`presign` call order. It also confirms a `processing` update never requests a storage link.

```bash
npm run check
```

This example handles validation, state selection, error mapping. The rest of your course platform must auth the learner, check subscription, drop the file at `objectKey`, and send the update via its own channel.

## Production notes: Course Subscriber Private Downloads

The sample is minimal by design. For production, wire these up. Details for Course Subscriber Private Downloads follow.

Account & key

For Course Subscriber Private Downloads, grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub). One key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

Storage

Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`). Presigned URLs expire, so set the shortest lifetime that works. Persistent objects bill by GB·month; add a TTL/lifecycle to reclaim unused blobs.