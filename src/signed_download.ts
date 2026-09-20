export type SubscriberUpdate = {
  creatorId: string;
  subscriberId: string;
  courseSlug: string;
  lessonSlug: string;
  objectKey: string;
  contentStatus: "processing" | "ready";
};

export type StorageForDownloads = {
  head(bucket: string, key: string): Promise<{ found: boolean }>;
  presign(
    bucket: string,
    key: string,
    body: {
      op: "get";
      expires_seconds: number;
      response_disposition: string;
      idempotency_key: string;
    },
  ): Promise<{ url: string }>;
};

export type DeliveryDecision =
  | { state: "processing"; lessonSlug: string }
  | { state: "unavailable"; lessonSlug: string }
  | { state: "ready"; lessonSlug: string; downloadUrl: string; expiresSeconds: number };

export async function prepareSubscriberDownload(
  storage: StorageForDownloads,
  bucket: string,
  update: SubscriberUpdate,
): Promise<DeliveryDecision> {
  if (update.contentStatus === "processing") {
    return { state: "processing", lessonSlug: update.lessonSlug };
  }

  const object = await storage.head(bucket, update.objectKey);
  if (!object.found) {
    return { state: "unavailable", lessonSlug: update.lessonSlug };
  }

  const expiresSeconds = 900;
  const signed = await storage.presign(bucket, update.objectKey, {
    op: "get",
    expires_seconds: expiresSeconds,
    response_disposition: `attachment; filename="${update.lessonSlug}.pdf"`,
    idempotency_key: [update.creatorId, update.subscriberId, update.lessonSlug].join(":"),
  });
  return {
    state: "ready",
    lessonSlug: update.lessonSlug,
    downloadUrl: signed.url,
    expiresSeconds,
  };
}
