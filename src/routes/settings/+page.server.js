import db from '$lib/db.js';

export function load() {
  const settings = db.prepare('SELECT * FROM search_settings WHERE id = 1').get();

  return {
    settings: settings || {
      id: 1,
      min_salary: 0,
      work_model: 'remote',
      exclude_keywords: '',
    },
  };
}

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const minSalary = Number(data.get('min_salary')) || 0;
    const workModel = data.get('work_model') || 'remote';
    const excludeKeywords = data.get('exclude_keywords')?.toString() || '';

    const existing = db.prepare('SELECT id FROM search_settings WHERE id = 1').get();

    if (existing) {
      db.prepare(`
        UPDATE search_settings
        SET min_salary = @min_salary,
            work_model = @work_model,
            exclude_keywords = @exclude_keywords
        WHERE id = 1
      `).run({
        min_salary: minSalary,
        work_model: workModel,
        exclude_keywords: excludeKeywords,
      });
    } else {
      db.prepare(`
        INSERT INTO search_settings (id, min_salary, work_model, exclude_keywords)
        VALUES (1, @min_salary, @work_model, @exclude_keywords)
      `).run({
        min_salary: minSalary,
        work_model: workModel,
        exclude_keywords: excludeKeywords,
      });
    }

    return { success: true };
  },
};
