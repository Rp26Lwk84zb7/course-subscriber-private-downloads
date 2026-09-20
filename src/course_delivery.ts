import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { infrai, InfraiError } from "./infrai.js";
import { prepareSubscriberDownload } from "./signed_download.js";

const bucket = process.env.COURSE_ASSET_BUCKET ?? "course-private-assets";
const port = Number(process.env.PORT ?? 3000);

const subscriberUpdateSchema = z.object({
  creatorId: z.string().min(1),
  subscriberId: z.string().min(1),
  courseSlug: z.string().min(1),
  lessonSlug: z.string().min(1),
  objectKey: z.string().min(1),
  contentStatus: z.enum(["processing", "ready"]),
});

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

await infrai.storage.bucket.create(bucket);

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/subscriber-updates") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const update = subscriberUpdateSchema.parse(await readJson(request));
    const decision = await prepareSubscriberDownload(
      {
        head: infrai.storage.object.head,
        presign: infrai.storage.object.presign,
      },
      bucket,
      update,
    );
    send(response, decision.state === "ready" ? 200 : 202, decision);
  } catch (error) {
    if (error instanceof z.ZodError) {
      send(response, 400, { error: "Invalid subscriber update", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code ?? "Request rejected", message: error.message });
      return;
    }
    send(response, 400, { error: "Request body must be valid JSON" });
  }
});

server.listen(port, () => {
  console.log(`Course delivery service listening on http://localhost:${port}`);
});
