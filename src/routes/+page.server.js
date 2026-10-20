import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.resolve('database/jobs.sqlite'));

export function load({ url }) {
  const limit = 20;
  const filter = url.searchParams.get('filter') || 'evaluated'; // Default to showing evaluated jobs!

  // 1. Live Queue & Tracking Breakdown
  const stats = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'pending' AND COALESCE(trashed, 0) = 0 THEN 1 ELSE 0 END) as pending_scrape,
      SUM(CASE WHEN status = 'extracted' AND COALESCE(trashed, 0) = 0 THEN 1 ELSE 0 END) as pending_ollama,
      SUM(CASE WHEN status = 'evaluated' AND COALESCE(trashed, 0) = 0 THEN 1 ELSE 0 END) as evaluated,
      SUM(CASE WHEN COALESCE(applied, 0) = 1 AND COALESCE(trashed, 0) = 0 THEN 1 ELSE 0 END) as applied,
      SUM(CASE WHEN COALESCE(trashed, 0) = 1 THEN 1 ELSE 0 END) as trashed,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
    FROM jobs
  `).get();

  // 2. Build WHERE clause based on selected filter tab
  let whereClause = "WHERE status != 'closed' AND COALESCE(trashed, 0) = 0";
  if (filter === 'evaluated') {
    whereClause = "WHERE status = 'evaluated' AND COALESCE(trashed, 0) = 0";
  } else if (filter === 'applied') {
    whereClause = "WHERE COALESCE(applied, 0) = 1 AND COALESCE(trashed, 0) = 0";
  } else if (filter === 'pending') {
    whereClause = "WHERE status IN ('pending', 'extracted') AND COALESCE(trashed, 0) = 0";
  } else if (filter === 'trashed') {
    whereClause = "WHERE COALESCE(trashed, 0) = 1";
  }

  const countResult = db.prepare(`SELECT COUNT(*) as count FROM jobs ${whereClause}`).get();
  const totalJobs = countResult?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalJobs / limit));

  const requestedPage = Number(url.searchParams.get('page')) || 1;
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const offset = (page - 1) * limit;

  const jobs = db.prepare(`
    SELECT * FROM jobs 
    ${whereClause}
    ORDER BY COALESCE(score, -1) DESC, id DESC 
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();

  return {
    jobs,
    stats,
    filter,
    totalJobs,
    currentPage: page,
    totalPages,
    settings
  };
}

export const actions = {
  toggleApplied: async ({ request }) => {
    const formData = await request.formData();
    const id = Number(formData.get('id'));
    const applied = Number(formData.get('applied'));
    db.prepare('UPDATE jobs SET applied = ? WHERE id = ?').run(applied, id);
    return { success: true };
  },

  trashJob: async ({ request }) => {
    const formData = await request.formData();
    const id = Number(formData.get('id'));
    const reason = String(formData.get('reason') || 'Removed by user');
    db.prepare('UPDATE jobs SET trashed = 1, user_feedback = ? WHERE id = ?').run(reason, id);
    return { success: true };
  },

  restoreJob: async ({ request }) => {
    const formData = await request.formData();
    const id = Number(formData.get('id'));
    db.prepare('UPDATE jobs SET trashed = 0, user_feedback = NULL WHERE id = ?').run(id);
    return { success: true };
  }
};