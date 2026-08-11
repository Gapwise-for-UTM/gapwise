import { authenticateSupabaseRequest } from "../src/server/private-cloud/auth.js";
import { handleJsonPost } from "../src/server/private-cloud/http.js";
import {
  issueDeviceKeyBundle,
  parseKeyBrokerBody,
} from "../src/server/private-cloud/key-broker.js";

export default {
  fetch(request: Request): Promise<Response> {
    return handleJsonPost(request, async (body) => {
      const publicJwk = parseKeyBrokerBody(body);
      const authenticated = await authenticateSupabaseRequest(request);
      return issueDeviceKeyBundle(authenticated, publicJwk);
    });
  },
};
