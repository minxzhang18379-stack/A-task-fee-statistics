import { SimpleJWT, CryptoEngine } from "./jwt";

interface Env {
  DB: D1Database;
  API_PASSWORD?: string;
  MEMBER_PASSWORD?: string;
  JWT_SECRET?: string;
}

// POST: Authenticate username & password and return a signed JWT session token
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const jwtSecret = env.JWT_SECRET || env.API_PASSWORD || "pann_fallback_jwt_secret_token_key";

  let payload: { username?: string; password?: string };
  try {
    payload = await request.json() as { username?: string; password?: string };
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { username, password } = payload;
  if (!username || !password) {
    return new Response(JSON.stringify({ error: "Username and password are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Check if the UserCredential table is completely empty (Cold Start Check)
    const countResult = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM UserCredential"
    ).first() as { count: number } | null;

    const isDbEmpty = !countResult || countResult.count === 0;

    // 2. COLD START AUTO-BOOTSTRAP MIGRATION STRATEGY
    if (isDbEmpty) {
      const adminPass = env.API_PASSWORD || "admin123";
      const memberPass = env.MEMBER_PASSWORD || "member123";

      // If user inputs credentials matching the env passwords, bootstrap the DB automatically
      const isLoginAsAdmin = username.toLowerCase() === "admin" && password === adminPass;
      const isLoginAsMember = username.toLowerCase() === "member" && password === memberPass;

      if (isLoginAsAdmin || isLoginAsMember) {
        // Bootstrap admin account
        const adminSalt = CryptoEngine.generateSalt();
        const adminHash = await CryptoEngine.hashPassword(adminPass, adminSalt);
        await env.DB.prepare(
          "INSERT INTO UserCredential (username, password_hash, salt, role, created_at, is_active) VALUES (?, ?, ?, 'admin', ?, 1)"
        )
        .bind("admin", adminHash, adminSalt, Date.now())
        .run();

        // Bootstrap member account
        const memberSalt = CryptoEngine.generateSalt();
        const memberHash = await CryptoEngine.hashPassword(memberPass, memberSalt);
        await env.DB.prepare(
          "INSERT INTO UserCredential (username, password_hash, salt, role, created_at, is_active) VALUES (?, ?, ?, 'member', ?, 1)"
        )
        .bind("member", memberHash, memberSalt, Date.now())
        .run();

        const role = isLoginAsAdmin ? "admin" : "member";
        const tokenPayload = {
          username: isLoginAsAdmin ? "admin" : "member",
          role,
          exp: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
        };
        const token = await SimpleJWT.sign(tokenPayload, jwtSecret);

        return new Response(JSON.stringify({ token, role, username: tokenPayload.username }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // If DB is empty and credentials don't match default, reject
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid initial credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. STANDARD DATABASE CREDENTIAL VERIFICATION
    const dbUser = await env.DB.prepare(
      "SELECT * FROM UserCredential WHERE username = ? AND is_active = 1"
    )
    .bind(username.trim())
    .first() as { username: string; password_hash: string; salt: string; role: 'admin' | 'member' } | null;

    if (!dbUser) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid username or password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Compute input password hash with user's specific salt
    const computedHash = await CryptoEngine.hashPassword(password, dbUser.salt);

    if (computedHash !== dbUser.password_hash) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid username or password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate session JWT
    const tokenPayload = {
      username: dbUser.username,
      role: dbUser.role,
      exp: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
    };
    const token = await SimpleJWT.sign(tokenPayload, jwtSecret);

    return new Response(JSON.stringify({ token, role: dbUser.role, username: dbUser.username }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Authentication system error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};


