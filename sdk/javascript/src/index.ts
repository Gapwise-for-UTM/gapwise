export * from "./types.js";
import type {
  Building,
  CampusPlace,
  GapPlanRequest,
  GapPlanResult,
  RootResponse,
  RouteRequest,
  RouteResult,
} from "./types.js";

export interface GapwiseOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  headers?: HeadersInit;
}
export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}
export class GapwiseApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "GapwiseApiError";
  }
}
export class GapwiseTimeoutError extends Error {
  constructor(message = "The Gapwise API request timed out.") {
    super(message);
    this.name = "GapwiseTimeoutError";
  }
}
const DEFAULT_BASE_URL = "https://api.gapwise.ca/v1";

export class Gapwise {
  readonly buildings = {
    list: (options?: RequestOptions) =>
      this.request<{ buildings: Building[] }>("/buildings", {}, options).then((r) => r.buildings),
    get: (building: string, options?: RequestOptions) =>
      this.request<{ building: Building }>(
        `/buildings/${encodeURIComponent(required(building, "building"))}`,
        {},
        options,
      ).then((r) => r.building),
  };
  readonly places = {
    list: (options?: RequestOptions) =>
      this.request<{ places: CampusPlace[] }>("/places", {}, options).then((r) => r.places),
    get: (placeId: string, options?: RequestOptions) =>
      this.request<{ place: CampusPlace }>(
        `/places/${encodeURIComponent(required(placeId, "placeId"))}`,
        {},
        options,
      ).then((r) => r.place),
  };
  readonly routes = {
    calculate: (input: RouteRequest, options?: RequestOptions) =>
      this.request<{ route: RouteResult }>("/routes", json(input), options).then((r) => r.route),
  };
  readonly gaps = {
    plan: (input: GapPlanRequest, options?: RequestOptions) =>
      this.request<{ gapPlan: GapPlanResult }>("/gaps/plan", json(input), options).then(
        (r) => r.gapPlan,
      ),
  };
  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly headers: HeadersInit;
  constructor(options: GapwiseOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch;
    if (typeof this.fetcher !== "function")
      throw new TypeError("Gapwise requires a Fetch API implementation.");
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.headers = options.headers ?? {};
  }
  info(options?: RequestOptions) {
    return this.request<RootResponse>("", {}, options);
  }
  private async request<T>(
    path: string,
    init: RequestInit,
    options: RequestOptions = {},
  ): Promise<T> {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        signal,
        headers: { accept: "application/json", ...this.headers, ...init.headers },
      });
    } catch (cause) {
      if (timeout.aborted && !options.signal?.aborted) throw new GapwiseTimeoutError();
      throw cause;
    }
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      /* handled below */
    }
    if (!response.ok) {
      const apiError =
        body &&
        typeof body === "object" &&
        "error" in body &&
        body.error &&
        typeof body.error === "object"
          ? (body.error as { code?: string; message?: string; details?: unknown })
          : undefined;
      throw new GapwiseApiError(
        apiError?.message ?? `Gapwise API request failed with HTTP ${response.status}.`,
        response.status,
        apiError?.code ?? "http_error",
        apiError?.details,
        response.headers.get("x-request-id") ?? undefined,
      );
    }
    return body as T;
  }
}
function required(value: string, name: string) {
  if (!value?.trim()) throw new TypeError(`${name} must be a non-empty string.`);
  return value.trim();
}
function json(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}
