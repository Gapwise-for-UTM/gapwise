const DEFAULT_BASE_URL = "https://gapwise.ca";

async function readJson(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message =
      body && typeof body === "object" && typeof body.message === "string"
        ? body.message
        : `Gapwise API request failed with HTTP ${response.status}.`;
    const error = new Error(message);
    error.name = "GapwiseApiError";
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function cleanBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export class GapwiseClient {
  constructor(options = {}) {
    this.baseUrl = cleanBaseUrl(options.baseUrl);
    this.fetch = options.fetch || globalThis.fetch;
    if (typeof this.fetch !== "function") {
      throw new Error("GapwiseClient requires a Fetch API implementation.");
    }
  }

  async buildings() {
    const response = await this.fetch(`${this.baseUrl}/api/utm-buildings`, {
      headers: { accept: "application/json" },
    });
    return readJson(response);
  }

  async building(query) {
    if (!query || !String(query).trim()) throw new TypeError("building(query) requires a value.");
    const response = await this.fetch(
      `${this.baseUrl}/api/utm-building?q=${encodeURIComponent(String(query).trim())}`,
      { headers: { accept: "application/json" } },
    );
    return readJson(response);
  }

  async route(input) {
    if (!input || !input.from || !input.to) {
      throw new TypeError("route(input) requires from and to building values.");
    }
    const response = await this.fetch(`${this.baseUrl}/api/utm-route`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return readJson(response);
  }

  async planGap(input) {
    if (!input || !input.from || !input.to) {
      throw new TypeError("planGap(input) requires from and to building values.");
    }
    const response = await this.fetch(`${this.baseUrl}/api/utm-gap-plan`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return readJson(response);
  }
}

export function createGapwiseClient(options) {
  return new GapwiseClient(options);
}

export const gapwise = new GapwiseClient();
