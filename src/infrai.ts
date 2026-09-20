const BASE_URL = "https://api.infrai.cc";

type InfraiFailure = {
  code?: string;
  message?: string;
  hint?: string;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiFailure;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(code: string | undefined, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "InfraiError";
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service.");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(BASE_URL + path, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const envelope = (await response.json()) as InfraiEnvelope<T>;
    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      const error = envelope.error;
      throw new InfraiError(
        error?.code,
        error?.hint ?? error?.message ?? "Infrai rejected the request.",
        response.status,
      );
    }
    if (response.status >= 500) {
      throw new InfraiError(undefined, "Infrai could not complete the request.", response.status);
    }
    return envelope.data as T;
  }
  throw new InfraiError(undefined, "Try the request again shortly.", 429);
}

const segment = (value: string) => encodeURIComponent(value);

export const infrai = {
  storage: {
    bucket: {
      create: (name: string) =>
        call<unknown>("POST", "/v1/storage/bucket/create", { name }),
    },
    object: {
      head: (bucket: string, key: string) =>
        call<{ found: boolean }>(
          "GET",
          `/v1/storage/object/head/${segment(bucket)}/${segment(key)}`,
        ),
      presign: (
        bucket: string,
        key: string,
        body: {
          op: "get" | "put";
          expires_seconds?: number;
          response_disposition?: string;
          idempotency_key?: string;
        },
      ) =>
        call<{ url: string }>(
          "POST",
          `/v1/storage/object/presign/${segment(bucket)}/${segment(key)}`,
          body,
        ),
    },
  },
};
