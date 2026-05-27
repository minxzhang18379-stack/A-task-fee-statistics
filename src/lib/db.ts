import Database from '@tauri-apps/plugin-sql';

export const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

let dbInstance: Database | null = null;

export interface Task {
  id?: number;
  title: string;       // 任务名称
  photographer: string; // 拍摄人
  taskType: string;     // 任务类型
  taskDate: string;     // 任务日期
  fee: number;          // 稿费
}

// Get active database mode
export const getDbMode = (): 'cloud' | 'local' => {
  if (!isTauri) return 'cloud'; // Browser always runs in cloud sync mode
  return (localStorage.getItem('pann_db_mode') as 'cloud' | 'local') || 'local';
};

// Get remote server API base URL
const getApiBase = (): string => {
  if (!isTauri) return ''; // Relative paths inside the browser
  const storedUrl = localStorage.getItem('pann_server_url') || '';
  return storedUrl.replace(/\/$/, '');
};

// Get Authorization headers
const getHeaders = () => {
  const password = localStorage.getItem('pann_password') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${password}`,
  };
};

// Central HTTP REST Client for Cloudflare D1 backend
const cloudFetch = async (method: string, path: string, body?: any) => {
  const base = getApiBase();
  const url = `${base}${path}`;
  const options: RequestInit = {
    method,
    headers: getHeaders(),
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const res = await fetch(url, options);
  
  if (!res.ok) {
    if (res.status === 401) {
      // Auto sign out on authorization expiration
      localStorage.removeItem('pann_authenticated');
      localStorage.removeItem('pann_password');
      window.location.reload();
      throw new Error('会话过期，请重新登录');
    }
    const errText = await res.text();
    throw new Error(errText || `API error: ${res.status}`);
  }
  return res;
};

// Initialize native SQLite (Tauri-only)
export const initDb = async () => {
  if (!isTauri) {
    throw new Error('Local SQLite is only supported in Tauri desktop app.');
  }

  if (!dbInstance) {
    dbInstance = await Database.load('sqlite:tasks.db');

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
      console.error("Failed to run startup database name/title cleaning:", e);
    }

    try { await dbInstance.execute("DROP TABLE IF EXISTS Remuneration"); } catch (_) {}
    try { await dbInstance.execute("DROP TABLE IF EXISTS Task"); } catch (_) {}
  }
  return dbInstance;
};

// --- Simplified CRUD Router (Dynamic Cloud API vs Local SQLite) ---

export const getTasks = async (): Promise<Task[]> => {
  if (getDbMode() === 'cloud') {
    const res = await cloudFetch('GET', '/api/tasks');
    return await res.json() as Task[];
  } else {
    const db = await initDb();
    return await db.select<Task[]>('SELECT * FROM TaskRecord ORDER BY taskDate ASC, id ASC');
  }
};

export const addTask = async (task: Task): Promise<number> => {
  const cleanTitle = (task.title || '').split(/\s*地点[：:]\s*/)[0].trim();
  const cleanPhoto = (task.photographer || '').replace(/\s*[（\(]修图[）\)]/g, '').trim();

  if (getDbMode() === 'cloud') {
    const res = await cloudFetch('POST', '/api/tasks', {
      title: cleanTitle,
      photographer: cleanPhoto,
      taskType: task.taskType,
      taskDate: task.taskDate,
      fee: task.fee,
    });
    const data = await res.json() as { success: boolean; id: number };
    return data.id;
  } else {
    const db = await initDb();
    const result = await db.execute(
      'INSERT INTO TaskRecord (title, photographer, taskType, taskDate, fee) VALUES ($1, $2, $3, $4, $5)',
      [cleanTitle, cleanPhoto, task.taskType, task.taskDate, task.fee]
    );
    return result.lastInsertId as number;
  }
};

export const updateTask = async (task: Task): Promise<void> => {
  const cleanTitle = (task.title || '').split(/\s*地点[：:]\s*/)[0].trim();
  const cleanPhoto = (task.photographer || '').replace(/\s*[（\(]修图[）\)]/g, '').trim();

  if (getDbMode() === 'cloud') {
    await cloudFetch('PUT', '/api/tasks', {
      id: task.id,
      title: cleanTitle,
      photographer: cleanPhoto,
      taskType: task.taskType,
      taskDate: task.taskDate,
      fee: task.fee,
    });
  } else {
    const db = await initDb();
    await db.execute(
      'UPDATE TaskRecord SET title = $1, photographer = $2, taskType = $3, taskDate = $4, fee = $5 WHERE id = $6',
      [cleanTitle, cleanPhoto, task.taskType, task.taskDate, task.fee, task.id]
    );
  }
};

export const deleteTask = async (id: number): Promise<void> => {
  if (getDbMode() === 'cloud') {
    await cloudFetch('DELETE', `/api/tasks?id=${id}`);
  } else {
    const db = await initDb();
    await db.execute('DELETE FROM TaskRecord WHERE id = $1', [id]);
  }
};
