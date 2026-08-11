import { authenticateSupabaseRequest } from "../src/server/private-cloud/auth.js";
import { findCommonGaps, parseCommonGapBody } from "../src/server/private-cloud/common-gap.js";
import { handleJsonPost } from "../src/server/private-cloud/http.js";

export default {
  fetch(request: Request): Promise<Response> {
    return handleJsonPost(request, async (body) => {
      const { friendshipId, term } = parseCommonGapBody(body);
      const authenticated = await authenticateSupabaseRequest(request);
      return findCommonGaps(authenticated, friendshipId, term);
    });
  },
};
