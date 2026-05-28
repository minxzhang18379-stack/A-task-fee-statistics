import { SimpleJWT } from "./jwt";

interface Env {
  API_PASSWORD?: string;
  JWT_SECRET?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// Global Pages Middleware handler
export const onRequest: PagesFunction<Env>[] = [
  // 1. CORS Preflight & Response Header Interceptor
  async (context) => {
    const { request } = context;
    
    // Intercept CORS preflight OPTIONS requests globally
    if (request.method.toUpperCase() === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // Proceed with the next function in the chain
      const response = await context.next();
      
      // Clone the response to append global CORS headers
      const newResponse = new Response(response.body, response);
      for (const [key, value] of Object.entries(corsHeaders)) {
        newResponse.headers.set(key, value);
      }
      return newResponse;
    } catch (err: any) {
      // Global exception boundary
      console.error("Unhandled API exception:", err);
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          details: err.message || String(err),
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  },

  // 2. Centralized JWT Authentication Interceptor
  async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // Bypass authentication checks for the login endpoint (/api/auth)
    if (url.pathname === "/api/auth") {
      return await context.next();
    }

    const jwtSecret = env.JWT_SECRET || env.API_PASSWORD || "pann_fallback_jwt_secret_token_key";
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const decoded = await SimpleJWT.verify(token, jwtSecret);

    if (!decoded || !decoded.role) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired session token" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Attach verified user claims to the context data store for route handlers
    context.data.user = decoded;

    return await context.next();
  }
];
