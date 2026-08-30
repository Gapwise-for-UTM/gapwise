const URL = "https://api.easi.utoronto.ca/ttb/reference-data";

export default {
  async fetch() {
    const response = await fetch(URL, {
      headers: {
        Accept: "application/json",
        Referer: "https://ttb.utoronto.ca/",
        "User-Agent": "Gapwise/1.0 (+https://gapwise.ca)",
      },
    });
    const value = (await response.json()) as { payload?: Record<string, unknown> };
    const payload = value.payload ?? {};
    const samples = Object.fromEntries(
      Object.entries(payload).map(([key, raw]) => [key, Array.isArray(raw) ? raw.slice(0, 8) : raw]),
    );
    return new Response(JSON.stringify({ status: response.status, keys: Object.keys(payload), samples }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
