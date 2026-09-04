const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/u;

export type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

export function requestIdFrom(request: Request): string {
  const incoming = request.headers.get("x-request-id")?.trim() ?? "";
  if (REQUEST_ID_PATTERN.test(incoming)) return incoming;
  return `gw_req_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function safeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name.slice(0, 80),
      message: error.message.slice(0, 300),
    };
  }
  return { name: "UnknownError", message: "Unknown failure" };
}

export function logEvent(level: LogLevel, event: string, context: LogContext = {}): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    service: "gapwise-web",
    ...context,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function jsonResponse(
  requestId: string,
  data: unknown,
  status = 200,
  cacheControl = "no-store",
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl,
      "x-content-type-options": "nosniff",
      "x-request-id": requestId,
      "referrer-policy": "no-referrer",
    },
  });
}
