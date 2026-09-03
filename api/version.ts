import { jsonResponse, requestIdFrom } from "./_lib/observability";

export default {
  async fetch(request: Request) {
    const requestId = requestIdFrom(request);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return jsonResponse(requestId, { error: "method_not_allowed" }, 405);
    }

    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
    const branch = process.env.VERCEL_GIT_COMMIT_REF?.trim() || null;
    const environment = process.env.VERCEL_ENV?.trim() || "unknown";

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
  },
};
