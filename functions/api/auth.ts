import { SimpleJWT } from "./jwt";

interface Env {
  API_PASSWORD?: string;
  MEMBER_PASSWORD?: string;
  JWT_SECRET?: string;
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

// GET: Authenticate user role by validating static password and returning a secure signed JWT
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const adminPassword = env.API_PASSWORD || "admin123";
  const memberPassword = env.MEMBER_PASSWORD || "member123";
  // Dynamic JWT Secret with secure fallback based on static credentials
  const jwtSecret = env.JWT_SECRET || env.API_PASSWORD || "pann_fallback_jwt_secret_token_key";
  
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized: Missing Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Extract static password from Bearer token
  const staticPass = authHeader.replace(/^Bearer\s+/i, "");

  let role: 'admin' | 'member' | null = null;
  if (staticPass === adminPassword) {
    role = 'admin';
  } else if (staticPass === memberPassword) {
    role = 'member';
  }

  if (!role) {
    return new Response(JSON.stringify({ error: "Unauthorized: Invalid password" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Generate JWT token with 12-hour expiration window
    const payload = {
      role,
      exp: Date.now() + 12 * 60 * 60 * 1000, // 12 hours from now
    };
    const token = await SimpleJWT.sign(payload, jwtSecret);

    return new Response(JSON.stringify({ token, role }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Token generation failed", details: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

