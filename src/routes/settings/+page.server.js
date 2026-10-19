import Database from 'better-sqlite3';

const db = new Database('database/jobs.sqlite');

// Ensure tables exist
db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        min_salary INTEGER DEFAULT 140000,
        work_models TEXT DEFAULT 'Remote,Hybrid',
        exclude_keywords TEXT DEFAULT 'unpaid, intern, clearance',
        target_senders TEXT DEFAULT 'alert@indeed.com, jobalerts-noreply@linkedin.com',
        blocked_senders TEXT DEFAULT ''
    )
`).run();
db.prepare(`INSERT OR IGNORE INTO settings (id) VALUES (1)`).run();

export function load() {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  return { settings };
}

export const actions = {
  saveSettings: async ({ request }) => {
    const data = await request.formData();
    const min_salary = data.get('min_salary') || 0;
    const work_models = data.getAll('work_model').join(',');
    const include_keywords = data.get('include_keywords') || '';
    const exclude_keywords = data.get('exclude_keywords') || '';
    const target_senders = data.get('target_senders') || '';
    const blocked_senders = data.get('blocked_senders') || '';

    db.prepare('UPDATE settings SET min_salary = ?, work_models = ?, include_keywords = ?, exclude_keywords = ?, target_senders = ?, blocked_senders = ? WHERE id = 1')
      .run(min_salary, work_models, include_keywords, exclude_keywords, target_senders, blocked_senders);
    return { success: true };
  }
};
