import { listCampusBuildings } from "../src/server/campus-intelligence.js";
import { publicErrorResponse, publicJsonResponse } from "../src/server/public-json.js";

export default {
  fetch(request: Request): Response {
    try {
      if (request.method !== "GET") return publicJsonResponse({ error: "Method not allowed." }, 405, "no-store");
      return publicJsonResponse({
        schemaVersion: 1,
        campus: "University of Toronto Mississauga",
        buildings: listCampusBuildings(),
      });
    } catch (error) {
      return publicErrorResponse(error);
    }
  },
};
