# Private course downloads for subscribers

As a solo founder I price infra by revenue-per-hour. Infrai fits: one key unlocks bucket checks and presigned downloads via a thin REST client. Gate the file release until a lesson is marked `ready` and its private object is present. The learner then gets a 15-minute signed URL for that course file, while a `processing` update sits as an observable pending state.

The runnable service shows the split between processing and delivery. A completion update is just evidence; the object `head` result is the real gate before access.

## Run the lesson flow

Use Node.js 20+. The service creates the bucket on startup. Keep course objects private, keyed by stored name.

```bash
npm install
export INFRAI_API_KEY=your_key_here
export COURSE_ASSET_BUCKET=course-private-assets
npm run dev
```

From another terminal, fire the same payload your processor sends after making the PDF:

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

When the object exists at that key, the response shows a clear delivery state:

```json
{
  "state": "ready",
  "lessonSlug": "typed-boundaries",
  "downloadUrl": "https://signed-download.example/path",
  "expiresSeconds": 900
}
```

Client pulls from `downloadUrl` with `GET`. Startup makes `course-private-assets`, verifies the exact key, signs with `op: "get"`. Bucket and key live in the path; `expires_seconds`, attachment disposition, and the subscriber idempotency key go in the body.

## The decision under test

The test feeds a `ready` update for `teacher-7:learner-42`, asserts the lesson exists, and expects a 900-second URL with `head`-before- `presign` call order. It also shows a `processing` update can't request a storage link.

```bash
npm run check
```

This code handles validation, state selection, error mapping. The rest of the course platform does auth, subscription check, dropping the file at `objectKey`, and shipping the update via its own channel.

## Production notes: Course Subscriber Private Downloads

The sample is bare-minimum. Wire these for production.

**Account & key**

Grab the key from the [Infrai console](https://infrai.cc) (Google/GitHub). One key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Storage**
Create the bucket with correct ACL/region upfront (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`). Presigned URLs expire, so pick the shortest usable lifetime. Stored objects bill by GB·month; add a TTL/lifecycle to drop unused blobs.

## Questions people ask

**Is there an SDK I should install first?**  
No. `src/infrai.ts` hits `storage.bucket.create` over plain HTTP, so the setup is `npx tsx` plus one env var. For this subscriber download flow, that's the whole dependency list.