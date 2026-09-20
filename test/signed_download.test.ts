import assert from "node:assert/strict";
import test from "node:test";
import { prepareSubscriberDownload, type StorageForDownloads } from "../src/signed_download.js";

test("a ready lesson with a stored asset receives a 15-minute subscriber link", async () => {
  const calls: Array<{ name: string; body?: unknown }> = [];
  const storage: StorageForDownloads = {
    async head() {
      calls.push({ name: "head" });
      return { found: true };
    },
    async presign(_bucket, _key, body) {
      calls.push({ name: "presign", body });
      return { url: "https://downloads.example/lesson" };
    },
  };

  const result = await prepareSubscriberDownload(storage, "course-private-assets", {
    creatorId: "teacher-7",
    subscriberId: "learner-42",
    courseSlug: "practical-typescript",
    lessonSlug: "typed-boundaries",
    objectKey: "teacher-7/practical-typescript/typed-boundaries.pdf",
    contentStatus: "ready",
  });

  assert.deepEqual(result, {
    state: "ready",
    lessonSlug: "typed-boundaries",
    downloadUrl: "https://downloads.example/lesson",
    expiresSeconds: 900,
  });
  assert.equal(calls[0]?.name, "head");
  assert.deepEqual(calls[1], {
    name: "presign",
    body: {
      op: "get",
      expires_seconds: 900,
      response_disposition: 'attachment; filename="typed-boundaries.pdf"',
      idempotency_key: "teacher-7:learner-42:typed-boundaries",
    },
  });
});

test("processing content does not touch storage or issue a link", async () => {
  const storage: StorageForDownloads = {
    async head() {
      throw new Error("head should not be called");
    },
    async presign() {
      throw new Error("presign should not be called");
    },
  };

  const result = await prepareSubscriberDownload(storage, "course-private-assets", {
    creatorId: "teacher-7",
    subscriberId: "learner-42",
    courseSlug: "practical-typescript",
    lessonSlug: "typed-boundaries",
    objectKey: "teacher-7/practical-typescript/typed-boundaries.pdf",
    contentStatus: "processing",
  });

  assert.deepEqual(result, { state: "processing", lessonSlug: "typed-boundaries" });
});
