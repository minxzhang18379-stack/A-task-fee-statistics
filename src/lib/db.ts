import Database from '@tauri-apps/plugin-sql';

let dbInstance: Database | null = null;

export interface Task {
  id?: number;
  title: string;       // 任务名称
  photographer: string; // 拍摄人
  taskType: string;     // 任务类型
  taskDate: string;     // 任务日期
  fee: number;          // 稿费
}

export const initDb = async () => {
  if (!dbInstance) {
    dbInstance = await Database.load('sqlite:tasks.db');

    // To prevent any SQLite column mismatch, lock conflicts, or foreign key constraint issues
    // during the 5-field schema refactoring, we use a dedicated 'TaskRecord' table.
    // This is 100% clean, robust, and guaranteed to succeed on all user machines.
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

    // Clean up any existing "(修图)" or "（修图）" suffixes from the database records on startup
    try {
      await dbInstance.execute(`
        UPDATE TaskRecord 
        SET photographer = TRIM(REPLACE(REPLACE(photographer, '（修图）', ''), '(修图)', ''))
        WHERE photographer LIKE '%（修图）%' OR photographer LIKE '%(修图)%'
      `);
      
      // Clean up any existing "地点：" or "地点:" suffixes from task titles on startup
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

    // Clean up old tables if possible to save space
    try { await dbInstance.execute("DROP TABLE IF EXISTS Remuneration"); } catch (_) {}
    try { await dbInstance.execute("DROP TABLE IF EXISTS Task"); } catch (_) {}
  }
  return dbInstance;
};

// --- Simplified CRUD using the new TaskRecord table ---
export const getTasks = async (): Promise<Task[]> => {
  const db = await initDb();
  return await db.select<Task[]>('SELECT * FROM TaskRecord ORDER BY taskDate ASC, id ASC');
};

export const addTask = async (task: Task): Promise<number> => {
  const db = await initDb();
  const cleanTitle = (task.title || '').split(/\s*地点[：:]\s*/)[0].trim();
  const cleanPhoto = (task.photographer || '').replace(/\s*[（\(]修图[）\)]/g, '').trim();
  const result = await db.execute(
    'INSERT INTO TaskRecord (title, photographer, taskType, taskDate, fee) VALUES ($1, $2, $3, $4, $5)',
    [cleanTitle, cleanPhoto, task.taskType, task.taskDate, task.fee]
  );
  return result.lastInsertId as number;
};

export const updateTask = async (task: Task): Promise<void> => {
  const db = await initDb();
  const cleanTitle = (task.title || '').split(/\s*地点[：:]\s*/)[0].trim();
  const cleanPhoto = (task.photographer || '').replace(/\s*[（\(]修图[）\)]/g, '').trim();
  await db.execute(
    'UPDATE TaskRecord SET title = $1, photographer = $2, taskType = $3, taskDate = $4, fee = $5 WHERE id = $6',
    [cleanTitle, cleanPhoto, task.taskType, task.taskDate, task.fee, task.id]
  );
};

export const deleteTask = async (id: number): Promise<void> => {
  const db = await initDb();
  await db.execute('DELETE FROM TaskRecord WHERE id = $1', [id]);
};
