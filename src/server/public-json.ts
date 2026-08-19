const MAX_PUBLIC_BODY_BYTES = 8 * 1024;
const MAX_PUBLIC_RESPONSE_BYTES = 64 * 1024;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": "*",
} as const;

export class PublicApiError extends Error {
  constructor(
    readonly status: number,
    readonly publicMessage: string,
  ) {
    super(publicMessage);
  }
}

export function publicJsonResponse(
  value: unknown,
  status = 200,
  cacheControl = "public, max-age=300, stale-while-revalidate=3600",
): Response {
  const body = JSON.stringify(value);
  if (body === undefined || new TextEncoder().encode(body).byteLength > MAX_PUBLIC_RESPONSE_BYTES) {
    return new Response(JSON.stringify({ error: "Response is too large." }), {
      status: 503,
      headers: { ...JSON_HEADERS, "Cache-Control": "no-store" },
    });
  }
  return new Response(body, {
    status,
    headers: { ...JSON_HEADERS, "Cache-Control": cacheControl },
  });
}

export function publicErrorResponse(error: unknown): Response {
  if (error instanceof PublicApiError) {
    return publicJsonResponse({ error: error.publicMessage }, error.status, "no-store");
  }
  return publicJsonResponse({ error: "Campus intelligence is temporarily unavailable." }, 503, "no-store");
}

export async function readPublicJson(request: Request): Promise<unknown> {
  if (request.method !== "POST") throw new PublicApiError(405, "Method not allowed.");
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") throw new PublicApiError(415, "JSON request required.");
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_PUBLIC_BODY_BYTES) {
      throw new PublicApiError(413, "Request body is too large.");
    }
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_PUBLIC_BODY_BYTES) {
    throw new PublicApiError(413, "Request body is too large.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new PublicApiError(400, "Request body is malformed.");
  }
}

export function exactPublicObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PublicApiError(400, "Request body is malformed.");
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new PublicApiError(400, "Request body is malformed.");
  }
  return record;
}

export function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 160) {
    throw new PublicApiError(400, `Invalid ${key}.`);
  }
  return value.trim();
}
