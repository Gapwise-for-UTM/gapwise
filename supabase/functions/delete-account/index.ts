import { createClient } from "https://esm.sh/@supabase/supabase-js@2.111.0";

const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function cors(origin: string | null): HeadersInit {
  const allowed = origin && configuredOrigins.includes(origin) ? origin : configuredOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowed ?? "https://campus-gap-finder.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = { ...cors(origin), "Content-Type": "application/json" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST" || (origin && !configuredOrigins.includes(origin)))
    return new Response(JSON.stringify({ error: "Request rejected" }), { status: 403, headers });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token)
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers,
    });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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
