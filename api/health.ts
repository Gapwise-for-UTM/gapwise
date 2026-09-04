import { jsonResponse, logEvent, requestIdFrom, safeError } from "./_lib/observability";

const UPSTREAM_TIMEOUT_MS = 2500;

async function probe(url: string): Promise<{ ok: boolean; latencyMs: number }> {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    return {
      ok: response.status > 0 && response.status < 500,
      latencyMs: Math.round(performance.now() - started),
    };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - started) };
  }
}

function versionResponse(requestId: string) {
  const commit = process.env["VERCEL_GIT_COMMIT_SHA"]?.trim() || null;
  const branch = process.env["VERCEL_GIT_COMMIT_REF"]?.trim() || null;
  const environment = process.env["VERCEL_ENV"]?.trim() || "unknown";

  return jsonResponse(
    requestId,
    {
      schemaVersion: 1,
      service: "gapwise-web",
      environment,
      revision: commit ? commit.slice(0, 12) : null,
      branch,
    },
    200,
    "public, s-maxage=60, stale-while-revalidate=300",
  );
}

export default {
  async fetch(request: Request) {
    const requestId = requestIdFrom(request);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return jsonResponse(requestId, { error: "method_not_allowed" }, 405);
    }

    const url = new URL(request.url);
    if (url.searchParams.get("view") === "version") {
      return versionResponse(requestId);
    }

    const started = performance.now();
    try {
      const [docs, data, ai] = await Promise.all([
        probe("https://docs.gapwise.ca"),
        probe("https://data.gapwise.ca"),
        probe("https://ai.gapwise.ca"),
      ]);
      const dependencies = { docs, data, ai };
      const degraded = Object.values(dependencies).some((item) => !item.ok);
      const payload = {
        schemaVersion: 1,
        service: "gapwise-web",
        status: degraded ? "degraded" : "operational",
        checkedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - started),
        dependencies,
      };
      logEvent(degraded ? "warn" : "info", "health_check", {
        requestId,
        status: payload.status,
      });
      return jsonResponse(
        requestId,
        payload,
        200,
        "public, s-maxage=15, stale-while-revalidate=45",
      );
    } catch (error) {
      logEvent("error", "health_check_failed", { requestId, error: safeError(error) });
      return jsonResponse(
        requestId,
        {
          schemaVersion: 1,
          service: "gapwise-web",
          status: "degraded",
          checkedAt: new Date().toISOString(),
        },
        200,
        "public, s-maxage=10",
      );
    }
  },
};
