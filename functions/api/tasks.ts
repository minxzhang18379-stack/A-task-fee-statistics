interface Env {
  DB: D1Database;
  API_PASSWORD?: string;
  MEMBER_PASSWORD?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// Helper to check Bearer token auth and return active user role
function getUserRole(request: Request, env: Env): 'admin' | 'member' | null {
  const adminPassword = env.API_PASSWORD || "admin123";
  const memberPassword = env.MEMBER_PASSWORD || "member123";
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader) return null;
  if (authHeader === `Bearer ${adminPassword}`) {
    return 'admin';
  }
  if (authHeader === `Bearer ${memberPassword}`) {
    return 'member';
  }
  return null;
}

// Handler for CORS preflight options
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

// GET: Fetch all task records
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const role = getUserRole(request, env);

  if (!role) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM TaskRecord ORDER BY taskDate ASC, id ASC"
    ).all();
    
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

// POST: Add a new task record
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const role = getUserRole(request, env);

  if (!role) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const task = await request.json() as {
      title: string;
      photographer: string;
      taskType: string;
      taskDate: string;
      fee: number;
    };

    const cleanTitle = (task.title || '').split(/\s*地点[：:]\s*/)[0].trim();
    const cleanPhoto = (task.photographer || '').replace(/\s*[（\(]修图[）\)]/g, '').trim();

    const result = await env.DB.prepare(
      "INSERT INTO TaskRecord (title, photographer, taskType, taskDate, fee) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(cleanTitle, cleanPhoto, task.taskType || "", task.taskDate || "", task.fee || 0)
    .run();

    return new Response(
      JSON.stringify({ success: true, id: result.meta.last_row_id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

// PUT: Update an existing task record
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const role = getUserRole(request, env);

  if (!role) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const task = await request.json() as {
      id: number;
      title: string;
      photographer: string;
      taskType: string;
      taskDate: string;
      fee: number;
    };

    if (!task.id) {
      return new Response(JSON.stringify({ error: "Task ID is required for update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanTitle = (task.title || '').split(/\s*地点[：:]\s*/)[0].trim();
    const cleanPhoto = (task.photographer || '').replace(/\s*[（\(]修图[）\)]/g, '').trim();

    await env.DB.prepare(
      "UPDATE TaskRecord SET title = ?, photographer = ?, taskType = ?, taskDate = ?, fee = ? WHERE id = ?"
    )
    .bind(cleanTitle, cleanPhoto, task.taskType || "", task.taskDate || "", task.fee || 0, task.id)
    .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

// DELETE: Delete a task record by ID (ADMIN ONLY!)
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const role = getUserRole(request, env);

  if (!role) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Strict role checking on delete requests
  if (role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Forbidden: Only Administrators are allowed to delete tasks" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return new Response(JSON.stringify({ error: "Task ID is required for delete" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await env.DB.prepare("DELETE FROM TaskRecord WHERE id = ?").bind(Number(id)).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
