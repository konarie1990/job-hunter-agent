import Database from 'better-sqlite3';

const db = new Database('database/jobs.sqlite');

// Ensure tables exist
db.prepare(`
    CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT, query_url TEXT, is_active INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        min_salary INTEGER DEFAULT 140000,
        work_models TEXT DEFAULT 'Remote,Hybrid',
        exclude_keywords TEXT DEFAULT 'unpaid, intern, clearance'
    )
`).run();
db.prepare(`INSERT OR IGNORE INTO settings (id) VALUES (1)`).run();

export function load() {
  const sources = db.prepare('SELECT * FROM sources ORDER BY id DESC').all();
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  return { sources, settings };
}

export const actions = {
  addSource: async ({ request }) => {
    const data = await request.formData();
    const source_type = data.get('source_type');
    const query_url = data.get('query_url');
    const is_active = data.get('is_active') ? 1 : 0;

    db.prepare('INSERT INTO sources (source_type, query_url, is_active) VALUES (?, ?, ?)')
      .run(source_type, query_url, is_active);

    return { success: true };
  },

  deleteSource: async ({ request }) => {
    const data = await request.formData();
    const id = data.get('id');

    db.prepare('DELETE FROM sources WHERE id = ?').run(id);
    return { success: true };
  },

  saveSettings: async ({ request }) => {
    const data = await request.formData();
    const min_salary = data.get('min_salary') || 0;
    const work_models = data.getAll('work_model').join(',');
    const include_keywords = data.get('include_keywords') || '';
    const exclude_keywords = data.get('exclude_keywords') || '';

    db.prepare('UPDATE settings SET min_salary = ?, work_models = ?, include_keywords = ?, exclude_keywords = ? WHERE id = 1')
      .run(min_salary, work_models, include_keywords, exclude_keywords);
    return { success: true };
  }
};