// --- Cloudflare Pages Functions: Serverless API with D1 SQLite Backend ---

const headers = {
  'Content-Type': 'application/json;charset=UTF-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS Preflight OPTIONS requests
export async function onRequestOptions() {
  return new Response(null, { headers });
}

// 1. GET /api/tasks - 获取所有任务
export async function onRequestGet(context) {
  const { DB } = context.env;
  if (!DB) {
    return new Response(JSON.stringify({ error: "D1 数据库绑定未配置" }), { status: 500, headers });
  }

  try {
    // Queries TaskRecord table directly, matching the exact format in SQLite/Tauri
    const { results } = await DB.prepare(
      "SELECT * FROM TaskRecord ORDER BY taskDate ASC, id ASC"
    ).all();
    return new Response(JSON.stringify(results), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: "读取数据库失败", details: err.message }), { status: 500, headers });
  }
}

// 2. POST /api/tasks - 添加新任务
export async function onRequestPost(context) {
  const { DB } = context.env;
  if (!DB) return new Response(JSON.stringify({ error: "D1 数据库绑定未配置" }), { status: 500, headers });

  try {
    const { title, photographer, taskType, taskDate, fee } = await context.request.json();

    if (!title || !taskDate) {
      return new Response(JSON.stringify({ error: "任务名称和日期是必填项" }), { status: 400, headers });
    }

    // Clean suffixes rules (Same logic as in SQLite/Tauri version)
    const cleanTitle = (title || '').split(/\s*地点[：:]\s*/)[0].trim();
    const cleanPhoto = (photographer || '').replace(/\s*[（\(]修图[）\)]/g, '').trim();

    // Insert task into D1 database
    const info = await DB.prepare(
      "INSERT INTO TaskRecord (title, photographer, taskType, taskDate, fee) VALUES (?1, ?2, ?3, ?4, ?5)"
    ).bind(cleanTitle, cleanPhoto, taskType || '非重大', taskDate, Number(fee) || 0).run();

    return new Response(JSON.stringify({ id: info.meta.last_row_id || 1 }), { status: 201, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: "添加任务失败", details: err.message }), { status: 500, headers });
  }
}

// 3. PUT /api/tasks/:id - 更新任务 & 4. DELETE /api/tasks/:id - 删除任务
export async function onRequest(context) {
  const { request, env } = context;
  const { DB } = env;
  if (!DB) return new Response(JSON.stringify({ error: "D1 数据库绑定未配置" }), { status: 500, headers });

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean); // e.g. ["api", "tasks", "123"]
  
  const method = request.method.toUpperCase();
  
  // Custom routing parser for wildcard PUT & DELETE since CF Workers routing is directory-based
  if (pathParts.length === 3 && pathParts[1] === 'tasks') {
    const id = parseInt(pathParts[2], 10);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: "无效的任务ID" }), { status: 400, headers });
    }

    if (method === 'PUT') {
      try {
        const { title, photographer, taskType, taskDate, fee } = await request.json();
        
        const cleanTitle = (title || '').split(/\s*地点[：:]\s*/)[0].trim();
        const cleanPhoto = (photographer || '').replace(/\s*[（\(]修图[）\)]/g, '').trim();

        await DB.prepare(
          "UPDATE TaskRecord SET title = ?1, photographer = ?2, taskType = ?3, taskDate = ?4, fee = ?5 WHERE id = ?6"
        ).bind(cleanTitle, cleanPhoto, taskType, taskDate, Number(fee) || 0, id).run();

        return new Response(JSON.stringify({ success: true }), { headers });
      } catch (err) {
        return new Response(JSON.stringify({ error: "更新任务失败", details: err.message }), { status: 500, headers });
      }
    }

    if (method === 'DELETE') {
      try {
        await DB.prepare("DELETE FROM TaskRecord WHERE id = ?1").bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers });
      } catch (err) {
        return new Response(JSON.stringify({ error: "删除任务失败", details: err.message }), { status: 500, headers });
      }
    }
  }

  // Fallback 404 for unmatched wildcard actions
  return new Response(JSON.stringify({ error: "Method not allowed or endpoint not found" }), { status: 404, headers });
}
