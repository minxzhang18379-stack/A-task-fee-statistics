interface Env {
  API_PASSWORD?: string;
  MEMBER_PASSWORD?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// CORS preflight options
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

// GET: Authenticate user role by validation Bearer token
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const adminPassword = env.API_PASSWORD || "admin123";
  const memberPassword = env.MEMBER_PASSWORD || "member123";
  
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (authHeader === `Bearer ${adminPassword}`) {
    return new Response(JSON.stringify({ role: "admin" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (authHeader === `Bearer ${memberPassword}`) {
    return new Response(JSON.stringify({ role: "member" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};
