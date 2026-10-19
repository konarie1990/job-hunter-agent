import db from '$lib/db.js';

export function load() {
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY score DESC').all();
  return {
    jobs,
  };
}
