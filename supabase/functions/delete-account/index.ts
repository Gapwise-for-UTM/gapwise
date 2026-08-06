import { createClient } from "https://esm.sh/@supabase/supabase-js@2.111.0";

const defaultOrigins = [
  "https://gapwise-utm.vercel.app",
  "https://campus-gap-finder.vercel.app",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];
const configuredOrigins = new Set([
  ...defaultOrigins,
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

function cors(origin: string | null): HeadersInit {
  return {
    ...(origin && configuredOrigins.has(origin)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const originAllowed = !origin || configuredOrigins.has(origin);
  const headers = { ...cors(origin), "Content-Type": "application/json" };

  if (request.method === "OPTIONS") {
    if (!originAllowed)
      return new Response(JSON.stringify({ error: "Request rejected" }), {
        status: 403,
        headers,
      });
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST" || !originAllowed)
    return new Response(JSON.stringify({ error: "Request rejected" }), { status: 403, headers });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token)
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers,
    });

  const url = Deno.env.get("SUPABASE_URL");
  let serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      serviceKey = (JSON.parse(secretKeys) as Record<string, string>)["default"] ?? serviceKey;
    } catch {
      // Retain the legacy key fallback while existing projects migrate.
    }
  }
  if (!url || !serviceKey)
    return new Response(JSON.stringify({ error: "Deletion unavailable" }), {
      status: 503,
      headers,
    });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error: authError } = await admin.auth.getUser(token);
  if (authError || !data.user)
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers,
    });

  // The verified token is the only source of identity. Cascading foreign keys remove
  // all strictly user-owned public rows; retries are safe if a prior attempt stopped early.
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error)
    return new Response(JSON.stringify({ error: "Deletion failed" }), { status: 500, headers });
  return new Response(JSON.stringify({ deleted: true }), { status: 200, headers });
});
