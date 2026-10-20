import Database from 'better-sqlite3';

const db = new Database('database/jobs.sqlite');

export function load() {
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY id DESC').all();
  return { jobs };
}

export const actions = {
  add: async ({ request }) => {
    const data = await request.formData();
    const sourceType = data.get('source_type');
    const queryUrl = data.get('query_url');

    const insert = db.prepare('INSERT INTO sources (source_type, query_url) VALUES (?, ?)');
    insert.run(sourceType, queryUrl);

    return { success: true };
  },
  delete: async ({ request }) => {
    const data = await request.formData();
    const id = data.get('id');

    const stmt = db.prepare('DELETE FROM sources WHERE id = ?');
    stmt.run(id);

    return { success: true };
  }
};