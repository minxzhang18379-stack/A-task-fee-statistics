import { CryptoEngine } from "../jwt";

interface Env {
  DB: D1Database;
}

interface UserContextData {
  user?: {
    username: string;
    role: 'admin' | 'member';
    exp: number;
  };
}

// Global role verification helper
function verifyAdminAccess(data: UserContextData): Response | null {
  const user = data.user;
  if (!user || user.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Forbidden: Administrator privileges required" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  return null;
}

// GET /api/admin/users - List all registered user accounts (ADMIN ONLY)
export const onRequestGet: PagesFunction<Env, any, UserContextData> = async (context) => {
  const { env, data } = context;
  const accessDenied = verifyAdminAccess(data);
  if (accessDenied) return accessDenied;

  const { results } = await env.DB.prepare(
    "SELECT username, role, created_at, is_active FROM UserCredential ORDER BY created_at ASC"
  ).all();

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
};

// POST /api/admin/users - Register a new user account (ADMIN ONLY)
export const onRequestPost: PagesFunction<Env, any, UserContextData> = async (context) => {
  const { request, env, data } = context;
  const accessDenied = verifyAdminAccess(data);
  if (accessDenied) return accessDenied;

  let payload: { username?: string; password?: string; role?: 'admin' | 'member' };
  try {
    payload = await request.json() as { username?: string; password?: string; role?: 'admin' | 'member' };
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { username, password, role } = payload;
  if (!username || !password || !role) {
    return new Response(JSON.stringify({ error: "Username, password, and role are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cleanUsername = username.trim();
  if (cleanUsername.length < 3) {
    return new Response(JSON.stringify({ error: "Username must be at least 3 characters long" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (role !== "admin" && role !== "member") {
    return new Response(JSON.stringify({ error: "Invalid role value" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check if username already exists
  const existing = await env.DB.prepare(
    "SELECT username FROM UserCredential WHERE username = ?"
  )
  .bind(cleanUsername)
  .first();

  if (existing) {
    return new Response(JSON.stringify({ error: "Username already exists" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Salt and hash password
  const salt = CryptoEngine.generateSalt();
  const hash = await CryptoEngine.hashPassword(password, salt);

  await env.DB.prepare(
    "INSERT INTO UserCredential (username, password_hash, salt, role, created_at, is_active) VALUES (?, ?, ?, ?, ?, 1)"
  )
  .bind(cleanUsername, hash, salt, role, Date.now())
  .run();

  return new Response(JSON.stringify({ success: true, message: "User account created successfully" }), {
    headers: { "Content-Type": "application/json" },
  });
};

// PUT /api/admin/users - Update a user's details, password, or status (ADMIN ONLY)
export const onRequestPut: PagesFunction<Env, any, UserContextData> = async (context) => {
  const { request, env, data } = context;
  const accessDenied = verifyAdminAccess(data);
  if (accessDenied) return accessDenied;

  const currentAdmin = data.user!.username;

  let payload: { username?: string; password?: string; role?: 'admin' | 'member'; is_active?: number };
  try {
    payload = await request.json() as { username?: string; password?: string; role?: 'admin' | 'member'; is_active?: number };
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { username, password, role, is_active } = payload;
  if (!username) {
    return new Response(JSON.stringify({ error: "Target username is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Prevent admin from disabling themselves
  if (username === currentAdmin && is_active === 0) {
    return new Response(JSON.stringify({ error: "Forbidden: You cannot disable your own administrator account" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify target user exists
  const existing = await env.DB.prepare("SELECT role FROM UserCredential WHERE username = ?")
    .bind(username)
    .first() as { role: string } | null;

  if (!existing) {
    return new Response(JSON.stringify({ error: "Target user not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build dynamic UPDATE query
  let queryParts: string[] = [];
  let queryBindings: any[] = [];

  if (password) {
    const salt = CryptoEngine.generateSalt();
    const hash = await CryptoEngine.hashPassword(password, salt);
    queryParts.push("password_hash = ?", "salt = ?");
    queryBindings.push(hash, salt);
  }

  if (role) {
    if (role !== "admin" && role !== "member") {
      return new Response(JSON.stringify({ error: "Invalid role value" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    queryParts.push("role = ?");
    queryBindings.push(role);
  }

  if (is_active !== undefined) {
    const statusVal = Number(is_active) === 1 ? 1 : 0;
    queryParts.push("is_active = ?");
    queryBindings.push(statusVal);
  }

  if (queryParts.length === 0) {
    return new Response(JSON.stringify({ error: "No fields specified for update" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const queryStr = `UPDATE UserCredential SET ${queryParts.join(", ")} WHERE username = ?`;
  queryBindings.push(username);

  await env.DB.prepare(queryStr).bind(...queryBindings).run();

  return new Response(JSON.stringify({ success: true, message: "User account updated successfully" }), {
    headers: { "Content-Type": "application/json" },
  });
};

// DELETE /api/admin/users - Delete a user account completely (ADMIN ONLY)
export const onRequestDelete: PagesFunction<Env, any, UserContextData> = async (context) => {
  const { request, env, data } = context;
  const accessDenied = verifyAdminAccess(data);
  if (accessDenied) return accessDenied;

  const currentAdmin = data.user!.username;
  const url = new URL(request.url);
  const targetUser = url.searchParams.get("username");

  if (!targetUser) {
    return new Response(JSON.stringify({ error: "Query parameter 'username' is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Prevent self-deletion
  if (targetUser === currentAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden: You cannot delete your own administrator account" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  await env.DB.prepare("DELETE FROM UserCredential WHERE username = ?").bind(targetUser).run();

  return new Response(JSON.stringify({ success: true, message: "User account deleted successfully" }), {
    headers: { "Content-Type": "application/json" },
  });
};
