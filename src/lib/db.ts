// --- Web / Tauri Cross-Platform Database Adapter ---

export interface Task {
  id?: number;
  title: string;       // 任务名称
  photographer: string; // 拍摄人
  taskType: string;     // 任务类型
  taskDate: string;     // 任务日期
  fee: number;          // 稿费
}

// 1. Detect if running inside Tauri desktop app
export const isTauri = (): boolean => {
  try {
    return typeof window !== 'undefined' && 
           typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' &&
           (window as any).__TAURI_INTERNALS__ !== null &&
           typeof (window as any).__TAURI_INTERNALS__?.metadata !== 'undefined';
  } catch {
    return false;
  }
};

// Helper: Get robust API URL dynamically mapping dev and prod environments
const getApiUrl = (path: string = ''): string => {
  const isDev = typeof window !== 'undefined' && window.location.port === '5173';
  const base = isDev ? 'http://localhost:3000' : '';
  return `${base}${path}`;
};

// 2. Tauri Database instance
let dbInstance: any = null;

export const initDb = async () => {
  if (isTauri()) {
    if (!dbInstance) {
      // Dynamic import of Tauri plugin-sql to prevent Web compilation crashes
      const Database = (await import('@tauri-apps/plugin-sql')).default;
      dbInstance = await Database.load('sqlite:tasks.db');

      // Initialize SQLite schema
      await dbInstance.execute(`
        CREATE TABLE IF NOT EXISTS TaskRecord (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          photographer TEXT NOT NULL DEFAULT '',
          taskType TEXT NOT NULL DEFAULT '',
          taskDate TEXT NOT NULL DEFAULT '',
          fee REAL NOT NULL DEFAULT 0
        )
      `);

      // Clean up suffixes from database records on startup
      try {
        await dbInstance.execute(`
          UPDATE TaskRecord 
          SET photographer = TRIM(REPLACE(REPLACE(photographer, '（修图）', ''), '(修图)', ''))
          WHERE photographer LIKE '%（修图）%' OR photographer LIKE '%(修图)%'
        `);
        await dbInstance.execute(`
          UPDATE TaskRecord 
          SET title = TRIM(SUBSTR(title, 1, INSTR(title, '地点：') - 1))
          WHERE INSTR(title, '地点：') > 0
        `);
        await dbInstance.execute(`
          UPDATE TaskRecord 
          SET title = TRIM(SUBSTR(title, 1, INSTR(title, '地点:') - 1))
          WHERE INSTR(title, '地点:') > 0
        `);
      } catch (e) {
        console.error("启动时 SQLite 名字/标题清理失败:", e);
      }

      // Clean up old tables
      try { await dbInstance.execute("DROP TABLE IF EXISTS Remuneration"); } catch (_) {}
      try { await dbInstance.execute("DROP TABLE IF EXISTS Task"); } catch (_) {}
    }
    return dbInstance;
  }
  return null;
};

// --- Web Fallback LocalStorage Database ---
const getLocalTasks = (): Task[] => {
  const data = localStorage.getItem('taskmaster_tasks');
  return data ? JSON.parse(data) : [];
};

const saveLocalTasks = (tasks: Task[]) => {
  localStorage.setItem('taskmaster_tasks', JSON.stringify(tasks));
};

// Helper: Clean values before saving (same rule as SQLite)
const getCleanedValues = (task: Task) => {
  const cleanTitle = (task.title || '').split(/\s*地点[：:]\s*/)[0].trim();
  const cleanPhoto = (task.photographer || '').replace(/\s*[（\(]修图[）\)]/g, '').trim();
  return {
    ...task,
    title: cleanTitle,
    photographer: cleanPhoto,
    taskType: task.taskType || '非重大',
    fee: Number(task.fee) || 0
  };
};

// --- Unified CRUD Interfaces ---

export const getTasks = async (): Promise<Task[]> => {
  if (isTauri()) {
    const db = await initDb();
    return await db.select<Task[]>('SELECT * FROM TaskRecord ORDER BY taskDate ASC, id ASC');
  }

  // Web Browser: Try Express server API first, fallback to localStorage
  try {
    const response = await fetch(getApiUrl('/api/tasks'));
    if (!response.ok) throw new Error("Server API returned error status");
    return await response.json();
  } catch (error) {
    console.warn("无法连接到协同服务器，正在使用本地浏览器存储:", error);
    const tasks = getLocalTasks();
    tasks.sort((a, b) => (a.taskDate || '').localeCompare(b.taskDate || ''));
    return tasks;
  }
};

export const addTask = async (task: Task): Promise<number> => {
  const cleanTask = getCleanedValues(task);

  if (isTauri()) {
    const db = await initDb();
    const result = await db.execute(
      'INSERT INTO TaskRecord (title, photographer, taskType, taskDate, fee) VALUES ($1, $2, $3, $4, $5)',
      [cleanTask.title, cleanTask.photographer, cleanTask.taskType, cleanTask.taskDate, cleanTask.fee]
    );
    return result.lastInsertId as number;
  }

  // Web Browser: Try Express server API, fallback to localStorage
  try {
    const response = await fetch(getApiUrl('/api/tasks'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanTask)
    });
    if (!response.ok) throw new Error("Server API insert error");
    const result = await response.json();
    return result.id;
  } catch (error) {
    console.warn("添加任务协同同步失败，正在保存到本地:", error);
    const tasks = getLocalTasks();
    const maxId = tasks.reduce((max, t) => (t.id && t.id > max ? t.id : max), 0);
    const newId = maxId + 1;
    const newTask = { ...cleanTask, id: newId };
    tasks.push(newTask);
    saveLocalTasks(tasks);
    return newId;
  }
};

export const updateTask = async (task: Task): Promise<void> => {
  if (!task.id) return;
  const cleanTask = getCleanedValues(task);

  if (isTauri()) {
    const db = await initDb();
    await db.execute(
      'UPDATE TaskRecord SET title = $1, photographer = $2, taskType = $3, taskDate = $4, fee = $5 WHERE id = $6',
      [cleanTask.title, cleanTask.photographer, cleanTask.taskType, cleanTask.taskDate, cleanTask.fee, cleanTask.id]
    );
    return;
  }

  // Web Browser: Try Express server API, fallback to localStorage
  try {
    const response = await fetch(getApiUrl(`/api/tasks/${cleanTask.id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanTask)
    });
    if (!response.ok) throw new Error("Server API update error");
  } catch (error) {
    console.warn("更新任务协同同步失败，正在修改本地存储:", error);
    const tasks = getLocalTasks();
    const index = tasks.findIndex(t => t.id === cleanTask.id);
    if (index !== -1) {
      tasks[index] = cleanTask;
      saveLocalTasks(tasks);
    }
  }
};

export const deleteTask = async (id: number): Promise<void> => {
  if (isTauri()) {
    const db = await initDb();
    await db.execute('DELETE FROM TaskRecord WHERE id = $1', [id]);
    return;
  }

  // Web Browser: Try Express server API, fallback to localStorage
  try {
    const response = await fetch(getApiUrl(`/api/tasks/${id}`), {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error("Server API delete error");
  } catch (error) {
    console.warn("删除任务协同同步失败，正在从本地移除:", error);
    const tasks = getLocalTasks();
    const filtered = tasks.filter(t => t.id !== id);
    saveLocalTasks(filtered);
  }
};
