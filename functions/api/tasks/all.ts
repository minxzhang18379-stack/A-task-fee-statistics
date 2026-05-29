interface Env {
  DB: D1Database;
}

interface UserContextData {
  user?: {
    role: 'admin' | 'member' | 'manager';
    exp: number;
  };
}

// DELETE /api/tasks/all - Clear all tasks (ADMIN ONLY!)
export const onRequestDelete: PagesFunction<Env, any, UserContextData> = async (context) => {
  const { env, data } = context;
  const user = data.user;

  // Strict role checking: only admin is authorized to clear the entire database
  if (!user || user.role !== "admin") {
    return new Response(
      JSON.stringify({ error: "Forbidden: Only Administrators are allowed to clear the database" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Clear entire TaskRecord table
  await env.DB.prepare("DELETE FROM TaskRecord").run();

  return new Response(
    JSON.stringify({ success: true, message: "所有任务已成功清空" }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
};
