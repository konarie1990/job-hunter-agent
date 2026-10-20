import Database from 'better-sqlite3';

const db = new Database('database/jobs.sqlite');
const PAGE_SIZE = 20;

export function load({ url }) {
  const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const totalCountRow = db.prepare('SELECT COUNT(*) as count FROM jobs').get();
  const totalJobs = totalCountRow ? totalCountRow.count : 0;
  const totalPages = Math.ceil(totalJobs / PAGE_SIZE) || 1;

  const validPage = Math.min(currentPage, totalPages);
  const offset = (validPage - 1) * PAGE_SIZE;

  const jobs = db
    .prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(PAGE_SIZE, offset);

  return {
    jobs,
    currentPage: validPage,
    totalPages,
    totalJobs,
  };
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
