import Database from 'better-sqlite3';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const db = new Database(path.resolve('database/jobs.sqlite'));

// Auto-ensure created_at column & backfill any NULL timestamps
function ensureJobsTimestampColumn() {
  const cols = db
    .prepare('PRAGMA table_info(jobs)')
    .all()
    .map((c) => c.name);

  if (!cols.includes('created_at')) {
    db.prepare('ALTER TABLE jobs ADD COLUMN created_at TEXT').run();
  }

  db.prepare(`
    UPDATE jobs 
    SET created_at = datetime('now', '-' || ((SELECT MAX(id) FROM jobs) - id) * 3 || ' minutes')
    WHERE created_at IS NULL OR created_at = ''
  `).run();
}

ensureJobsTimestampColumn();

let activeOllamaJobId = null;

export async function load({ url }) {
  const limit = 20;
  const filter = url.searchParams.get('filter') || 'evaluated';
  const sort = url.searchParams.get('sort') || 'score_desc';

  const stats = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'pending' AND COALESCE(trashed, 0) = 0 THEN 1 ELSE 0 END) as pending_scrape,
      SUM(CASE WHEN status = 'extracted' AND COALESCE(trashed, 0) = 0 THEN 1 ELSE 0 END) as pending_ollama,
      SUM(CASE WHEN status = 'evaluated' AND COALESCE(trashed, 0) = 0 AND COALESCE(applied, 0) = 0 THEN 1 ELSE 0 END) as evaluated,
      SUM(CASE WHEN COALESCE(applied, 0) = 1 AND COALESCE(trashed, 0) = 0 THEN 1 ELSE 0 END) as applied,
      SUM(CASE WHEN COALESCE(trashed, 0) = 1 THEN 1 ELSE 0 END) as trashed,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
    FROM jobs
  `).get();

  let whereClause = "WHERE status != 'closed' AND COALESCE(trashed, 0) = 0";
  if (filter === 'evaluated') {
    whereClause = "WHERE status = 'evaluated' AND COALESCE(trashed, 0) = 0 AND COALESCE(applied, 0) = 0";
  } else if (filter === 'applied') {
    whereClause = "WHERE COALESCE(applied, 0) = 1 AND COALESCE(trashed, 0) = 0";
  } else if (filter === 'pending') {
    whereClause = "WHERE status IN ('pending', 'extracted') AND COALESCE(trashed, 0) = 0";
  } else if (filter === 'trashed') {
    whereClause = "WHERE COALESCE(trashed, 0) = 1";
  }

  const orderByClause =
    sort === 'score_asc'
      ? 'ORDER BY COALESCE(score, 99) ASC, id DESC'
      : sort === 'date_asc'
        ? 'ORDER BY id ASC'
        : sort === 'date_desc'
          ? 'ORDER BY id DESC'
          : 'ORDER BY COALESCE(score, -1) DESC, id DESC';

  const countResult = db.prepare(`SELECT COUNT(*) as count FROM jobs ${whereClause}`).get();
  const totalJobs = countResult?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalJobs / limit));

  const requestedPage = Number(url.searchParams.get('page')) || 1;
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const offset = (page - 1) * limit;

  const jobs = db.prepare(`
    SELECT * FROM jobs 
    ${whereClause}
    ${orderByClause}
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();

  return {
    jobs,
    stats,
    filter,
    sort,
    totalJobs,
    currentPage: page,
    totalPages,
    settings,
    ollamaBusy: activeOllamaJobId !== null,
    activeOllamaJobId
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
  },

  scrapeSingleJob: async ({ request }) => {
    const formData = await request.formData();
    const id = Number(formData.get('id'));

    try {
      await execAsync(`node scripts/playwright-extractor.js --id=${id}`);
      return { scrapeSuccess: true, scrapedId: id };
    } catch (err) {
      return { scrapeError: true, message: err.message || 'Failed to scrape job with Playwright' };
    }
  },

  evaluateSingleJob: async ({ request }) => {
    const formData = await request.formData();
    const id = Number(formData.get('id'));

    if (activeOllamaJobId !== null) {
      return {
        ollamaError: true,
        message: `Ollama is currently busy evaluating Job #${activeOllamaJobId}. Please wait for it to finish.`
      };
    }

    activeOllamaJobId = id;
    try {
      await execAsync(`node scripts/ollama-client.js --id=${id}`);
      return { ollamaSuccess: true, evaluatedId: id };
    } catch (err) {
      return { ollamaError: true, message: err.message || 'Failed to evaluate job with Ollama' };
    } finally {
      activeOllamaJobId = null;
    }
  },

  generateCoverLetter: async ({ request }) => {
    const formData = await request.formData();
    const id = Number(formData.get('id'));

    try {
      await execAsync(`node scripts/ollama-client.js --id=${id} --force-cover-letter`);
      return { success: true };
    } catch (err) {
      return { error: true, message: err.message || 'Failed to generate cover letter' };
    }
  }
};