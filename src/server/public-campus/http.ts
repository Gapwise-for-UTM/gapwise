const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "x-content-type-options": "nosniff",
} as const;

export function jsonResponse(value: unknown, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...JSON_HEADERS, "cache-control": cacheControl },
  });
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}

export async function readBoundedJson(request: Request, maxBytes = 16_384): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new PublicApiError(413, "request_too_large", "Request body is too large.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new PublicApiError(413, "request_too_large", "Request body is too large.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new PublicApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function publicApiError(error: unknown) {
  if (error instanceof PublicApiError) {
    return jsonResponse({ error: error.code, message: error.message }, error.status);
  }
  return jsonResponse(
    { error: "internal_error", message: "Gapwise could not complete this public campus request." },
    500,
  );
}

export function exactObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PublicApiError(400, "invalid_request", "Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

export function requireString(value: unknown, name: string, max = 240) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new PublicApiError(400, "invalid_request", `${name} must be a non-empty string.`);
  }
  return value.trim();
}
