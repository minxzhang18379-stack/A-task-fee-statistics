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

// 获取当前数据库模式 (云端同步 / 单机离线)
export const getDbMode = (): 'cloud' | 'local' => {
  if (!isTauri) return 'cloud'; // 网页版始终为云端同步模式
  return (localStorage.getItem('pann_db_mode') as 'cloud' | 'local') || 'local';
};

// 获取远程 Cloudflare Pages API 地址
const getApiBase = (): string => {
  if (!isTauri) return ''; // 网页版使用相对路径
  const storedUrl = localStorage.getItem('pann_server_url') || '';
  return storedUrl.replace(/\/$/, '');
};

// 获取认证 Header
const getHeaders = () => {
  const token = localStorage.getItem('pann_jwt_token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

// 统一的云端 D1 数据库 REST 客户端
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
      // 会话过期或错误，自动登出并刷新
      localStorage.removeItem('pann_authenticated');
      localStorage.removeItem('pann_jwt_token');
      localStorage.removeItem('pann_user_role');
      window.location.reload();
      throw new Error('会话已过期，请重新登录');
    }
    const errText = await res.text();
    throw new Error(errText || `API 错误: ${res.status}`);
  }
  return res;
};

// 初始化单机 SQLite 数据库 (仅在桌面端可用)
export const initDb = async () => {
  if (!isTauri) {
    throw new Error('单机 SQLite 数据库仅在桌面端软件中受支持');
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
      console.error("启动时单机数据库名字/标题清洗失败:", e);
    }

    try { await dbInstance.execute("DROP TABLE IF EXISTS Remuneration"); } catch (_) {}
    try { await dbInstance.execute("DROP TABLE IF EXISTS Task"); } catch (_) {}
  }
  return dbInstance;
};

// --- CRUD 操作分流路由器 ---

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
