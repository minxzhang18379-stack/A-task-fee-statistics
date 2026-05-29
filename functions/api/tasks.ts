interface Env {
  DB: D1Database;
}

// User context interface populated by auth middleware
interface UserContextData {
  user?: {
    role: 'admin' | 'member';
    exp: number;
  };
}

// GET: Fetch all task records
export const onRequestGet: PagesFunction<Env, any, UserContextData> = async (context) => {
  const { env } = context;
  
  const { results } = await env.DB.prepare(
    "SELECT * FROM TaskRecord ORDER BY taskDate ASC, id ASC"
  ).all();
  
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
};

// POST: Add a new task record
export const onRequestPost: PagesFunction<Env, any, UserContextData> = async (context) => {
  const { request, env, data } = context;
  const user = data.user;

  // Strict role checking: only admin is authorized to add tasks
  if (!user || user.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Forbidden: Only Administrators are allowed to add tasks" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

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
      headers: { "Content-Type": "application/json" },
    }
  );
};

// PUT: Update an existing task record
export const onRequestPut: PagesFunction<Env, any, UserContextData> = async (context) => {
  const { request, env, data } = context;
  const user = data.user;

  // Strict role checking: only admin is authorized to edit tasks
  if (!user || user.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Forbidden: Only Administrators are allowed to edit tasks" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

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
      headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
  });
};

// DELETE: Delete a task record by ID (ADMIN ONLY!)
export const onRequestDelete: PagesFunction<Env, any, UserContextData> = async (context) => {
  const { request, env, data } = context;
  const user = data.user;

  // Strict role checking on delete requests
  if (!user || user.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Forbidden: Only Administrators are allowed to delete tasks" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "Task ID is required for delete" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await env.DB.prepare("DELETE FROM TaskRecord WHERE id = ?").bind(Number(id)).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

