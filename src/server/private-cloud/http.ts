export const MAX_API_BODY_BYTES = 8 * 1024;

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly publicMessage: string,
  ) {
    super(publicMessage);
  }
}

export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonResponse({ error: error.publicMessage }, error.status);
  }
  // Unknown crypto/database errors can carry sensitive context. Do not
  // serialize the caught value into either the response or server logs.
  return jsonResponse({ error: "The private cloud service is temporarily unavailable." }, 503);
}

export function requirePostFromSameOrigin(request: Request): void {
  if (request.method !== "POST") throw new ApiError(405, "Method not allowed.");

  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (!origin || origin !== requestOrigin) throw new ApiError(403, "Request origin rejected.");

  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") throw new ApiError(415, "JSON request required.");

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_API_BODY_BYTES) {
      throw new ApiError(413, "Request body is too large.");
    }
  }
}

export async function readLimitedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new ApiError(400, "Request body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_API_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, "Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ApiError(400, "Request body is malformed.");
  }
}

export function requireExactObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiError(400, "Request body is malformed.");
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ApiError(400, "Request body is malformed.");
  }
  return record;
}

export async function handleJsonPost(
  request: Request,
  action: (body: unknown) => Promise<unknown>,
): Promise<Response> {
  try {
    requirePostFromSameOrigin(request);
    return jsonResponse(await action(await readLimitedJson(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
