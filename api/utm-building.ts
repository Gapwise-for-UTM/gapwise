import { getPublicBuilding } from "../src/server/public-campus/service.js";
import { jsonResponse, optionsResponse } from "../src/server/public-campus/http.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return optionsResponse();
    if (request.method !== "GET") {
      return jsonResponse({ error: "method_not_allowed", message: "Use GET." }, 405);
    }
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (!query || query.length > 240) {
      return jsonResponse(
        { error: "invalid_request", message: "Supply a canonical building code or exact name in ?q=." },
        400,
      );
    }
    const result = getPublicBuilding(query);
    if (result.status === "not_found") {
      return jsonResponse(
        { error: "unknown_building", message: "Gapwise could not resolve that UTM building." },
        404,
      );
    }
    if (result.status === "ambiguous") {
      return jsonResponse(
        {
          error: "ambiguous_building",
          message: "That name matches more than one building. Use a canonical code.",
          candidates: result.candidates,
        },
        409,
      );
    }
    return jsonResponse({ service: "gapwise-public-campus", building: result.building }, 200, "public, max-age=3600, must-revalidate");
  },
};
