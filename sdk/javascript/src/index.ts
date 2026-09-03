export * from "./types.js";
import type {
  ApiInfo,
  Building,
  BuildingListOptions,
  CampusPlace,
  Collection,
  GapPlanRequest,
  GapPlanResult,
  PlaceListOptions,
  ResponseMeta,
  RouteRequest,
  RouteResult,
} from "./types.js";

/** Configuration used when constructing a {@link Gapwise} client. */
export interface GapwiseOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  headers?: HeadersInit;
}

/** Per-request cancellation and timeout overrides. */
export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Stable error code returned by the Gapwise public API. */
export type GapwiseErrorCode =
  | "ambiguous_building"
  | "building_not_found"
  | "http_error"
  | "internal_error"
  | "invalid_identifier"
  | "invalid_json"
  | "invalid_query"
  | "invalid_request"
  | "method_not_allowed"
  | "not_found"
  | "place_not_found"
  | "rate_limited"
  | "request_too_large"
  | (string & {});

/** Error returned for a valid HTTP response that reports an API failure. */
export class GapwiseApiError extends Error {
  override readonly name = "GapwiseApiError";
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: GapwiseErrorCode,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

/** Error thrown when a Gapwise request exceeds its configured timeout. */
export class GapwiseTimeoutError extends Error {
  override readonly name = "GapwiseTimeoutError";
  constructor(message = "The Gapwise API request timed out.") {
    super(message);
  }
}

/** Error thrown when a successful API response cannot be decoded safely. */
export class GapwiseResponseError extends Error {
  override readonly name = "GapwiseResponseError";
  constructor(message = "The Gapwise API returned an invalid JSON response.") {
    super(message);
  }
}

const DEFAULT_BASE_URL = "https://api.gapwise.ca/v1";
type Envelope<T> = { data: T; meta: ResponseMeta };

/** Official client for the unauthenticated Gapwise Public Campus API v1. */
export class Gapwise {
  /** Building discovery and lookup operations. */
  readonly buildings = {
    list: (
      filters: BuildingListOptions = {},
      options?: RequestOptions,
    ): Promise<Collection<Building>> =>
      this.requestCollection<Building>(`/buildings${query(filters)}`, options),
    get: (building: string, options?: RequestOptions): Promise<Building> =>
      this.request<Building>(
        `/buildings/${encodeURIComponent(required(building, "building"))}`,
        {},
        options,
      ).then((r) => r.data),
  };

  /** Campus-place discovery and lookup operations. */
  readonly places = {
    list: (
      filters: PlaceListOptions = {},
      options?: RequestOptions,
    ): Promise<Collection<CampusPlace>> =>
      this.requestCollection<CampusPlace>(`/places${query(filters)}`, options),
    get: (placeId: string, options?: RequestOptions): Promise<CampusPlace> =>
      this.request<CampusPlace>(
        `/places/${encodeURIComponent(required(placeId, "placeId"))}`,
        {},
        options,
      ).then((r) => r.data),
  };

  /** Campus route calculation operations. */
  readonly routes = {
    calculate: (input: RouteRequest, options?: RequestOptions): Promise<RouteResult> =>
      this.request<RouteResult>("/routes", json(input), options).then((r) => r.data),
  };

  /** Deterministic free-interval planning operations. */
  readonly gaps = {
    plan: (input: GapPlanRequest, options?: RequestOptions): Promise<GapPlanResult> =>
      this.request<GapPlanResult>("/gaps/plan", json(input), options).then((r) => r.data),
  };

  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly headers: Headers;

  /** Create a client using the canonical API endpoint unless overridden. */
  constructor(options: GapwiseOptions = {}) {
    this.baseUrl = trimTrailingSlashes(options.baseUrl ?? DEFAULT_BASE_URL);
    this.fetcher = options.fetch ?? globalThis.fetch;
    if (typeof this.fetcher !== "function")
      throw new TypeError("Gapwise requires a Fetch API implementation.");
    this.timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0)
      throw new TypeError("timeoutMs must be a positive finite number.");
    this.headers = new Headers({ accept: "application/json" });
    applyHeaders(this.headers, options.headers);
  }

  /** Return API, data-version, capability, and privacy metadata. */
  info(options?: RequestOptions): Promise<ApiInfo> {
    return this.request<ApiInfo>("", {}, options).then((r) => r.data);
  }

  private async requestCollection<T>(
    path: string,
    options?: RequestOptions,
  ): Promise<Collection<T>> {
    return this.request<T[]>(path, {}, options) as Promise<Collection<T>>;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    options: RequestOptions = {},
  ): Promise<Envelope<T>> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
      throw new TypeError("timeoutMs must be a positive finite number.");
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abort = (): void => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    const headers = new Headers(this.headers);
    applyHeaders(headers, init.headers);
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers,
      });
    } catch (cause) {
      if (controller.signal.aborted && !options.signal?.aborted) throw new GapwiseTimeoutError();
      throw cause;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (!response.ok)
        throw new GapwiseApiError(
          `Gapwise API request failed with HTTP ${response.status}.`,
          response.status,
          "http_error",
          undefined,
          response.headers.get("x-request-id") ?? undefined,
        );
      throw new GapwiseResponseError();
    }
    if (!response.ok) {
      const envelope =
        body && typeof body === "object"
          ? (body as {
              error?: { code?: string; message?: string; details?: unknown };
              meta?: { requestId?: string };
            })
          : {};
      throw new GapwiseApiError(
        envelope.error?.message ?? `Gapwise API request failed with HTTP ${response.status}.`,
        response.status,
        envelope.error?.code ?? "http_error",
        envelope.error?.details,
        envelope.meta?.requestId ?? response.headers.get("x-request-id") ?? undefined,
      );
    }
    if (!body || typeof body !== "object" || !("data" in body) || !("meta" in body))
      throw new GapwiseResponseError();
    return body as Envelope<T>;
  }
}

function applyHeaders(target: Headers, source?: HeadersInit): void {
  if (!source) return;
  new Headers(source).forEach((value, name) => target.set(name, value));
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
  return value.slice(0, end);
}

function required(value: string, name: string): string {
  if (!value?.trim()) throw new TypeError(`${name} must be a non-empty string.`);
  return value.trim();
}

function query(values: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values as Record<string, unknown>))
    if (value !== undefined) params.set(key, String(value));
  const result = params.toString();
  return result ? `?${result}` : "";
}

function json(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}
