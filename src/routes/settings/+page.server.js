import Database from 'better-sqlite3';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const db = new Database(path.resolve('database/jobs.sqlite'));

// Auto-migrate any missing columns in the settings table so saveSettings never crashes
function ensureSettingsColumns() {
  const existingCols = db
    .prepare('PRAGMA table_info(settings)')
    .all()
    .map((c) => c.name);

  const requiredCols = [
    ['min_salary', 'INTEGER DEFAULT 150000'],
    ['remote', 'INTEGER DEFAULT 1'],
    ['hybrid', 'INTEGER DEFAULT 1'],
    ['onsite', 'INTEGER DEFAULT 0'],
    ['target_keywords', "TEXT DEFAULT ''"],
    ['exclude_keywords', "TEXT DEFAULT ''"],
    ['target_senders', "TEXT DEFAULT 'alert@indeed.com, jobalerts-noreply@linkedin.com'"],
    ['blocked_senders', "TEXT DEFAULT ''"],
    ['extract_limit', 'INTEGER DEFAULT 10'],
    ['gmail_days', 'INTEGER DEFAULT 1'],
    ['custom_ollama_rules', "TEXT DEFAULT ''"],
    ['schedules', "TEXT DEFAULT ''"]
  ];

  for (const [colName, colDef] of requiredCols) {
    if (!existingCols.includes(colName)) {
      db.prepare(`ALTER TABLE settings ADD COLUMN ${colName} ${colDef}`).run();
    }
  }

  // Ensure row id = 1 exists
  const row = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!row) {
    db.prepare('INSERT INTO settings (id, min_salary) VALUES (1, 150000)').run();
  }
}

ensureSettingsColumns();

const DEFAULT_SCHEDULES = [
  {
    id: 'morning-mst',
    name: 'Morning Fast Scan (6:00 AM MT)',
    time: '06:00',
    enabled: true,
    extract_limit: 10,
    target_senders: 'alert@indeed.com, jobalerts-noreply@linkedin.com',
    target_keywords: 'Shopify, e-commerce, Liquid, SvelteKit, React'
  },
  {
    id: 'evening-mst',
    name: 'Evening Deep Scan (8:00 PM MT)',
    time: '20:00',
    enabled: true,
    extract_limit: 25,
    target_senders: 'alert@indeed.com, jobalerts-noreply@linkedin.com',
    target_keywords: 'Shopify, e-commerce, Liquid, SvelteKit, React'
  }
];

export function load() {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  let schedules = DEFAULT_SCHEDULES;
  try {
    if (settings?.schedules) {
      const parsed = JSON.parse(settings.schedules);
      if (Array.isArray(parsed) && parsed.length > 0) schedules = parsed;
    }
  } catch {
    schedules = DEFAULT_SCHEDULES;
  }

  const feedbackCounts = db.prepare(`
    SELECT 
      SUM(CASE WHEN COALESCE(applied, 0) = 1 THEN 1 ELSE 0 END) as applied_count,
      SUM(CASE WHEN COALESCE(trashed, 0) = 1 THEN 1 ELSE 0 END) as trashed_count
    FROM jobs
  `).get();

  return { settings, schedules, feedbackCounts };
}

export const actions = {
  saveSettings: async ({ request }) => {
    const formData = await request.formData();
    const min_salary = Number(formData.get('min_salary')) || 150000;
    const remote = formData.get('remote') === 'on' ? 1 : 0;
    const hybrid = formData.get('hybrid') === 'on' ? 1 : 0;
    const onsite = formData.get('onsite') === 'on' ? 1 : 0;
    const exclude_keywords = String(formData.get('exclude_keywords') || '');
    const blocked_senders = String(formData.get('blocked_senders') || '');
    const gmail_days = Number(formData.get('gmail_days')) || 1;
    const custom_ollama_rules = String(formData.get('custom_ollama_rules') || '');
    const schedulesJson = String(formData.get('schedules_json') || '[]');

    let parsedSchedules = DEFAULT_SCHEDULES;
    try {
      parsedSchedules = JSON.parse(schedulesJson);
    } catch {
      // fallback
    }

    const primary = parsedSchedules[0] || DEFAULT_SCHEDULES[0];

    db.prepare(`
      UPDATE settings
      SET min_salary = ?,
          remote = ?,
          hybrid = ?,
          onsite = ?,
          target_keywords = ?,
          exclude_keywords = ?,
          target_senders = ?,
          blocked_senders = ?,
          extract_limit = ?,
          gmail_days = ?,
          custom_ollama_rules = ?,
          schedules = ?
      WHERE id = 1
    `).run(
      min_salary,
      remote,
      hybrid,
      onsite,
      primary.target_keywords || '',
      exclude_keywords,
      primary.target_senders || 'alert@indeed.com, jobalerts-noreply@linkedin.com',
      blocked_senders,
      Number(primary.extract_limit) || 10,
      gmail_days,
      custom_ollama_rules,
      JSON.stringify(parsedSchedules)
    );

    return { success: true, message: 'Schedules, keyword boosters, and search parameters saved!' };
  },

  runManualPipeline: async ({ request }) => {
    const formData = await request.formData();
    const manualLimit = Number(formData.get('manual_limit')) || 10;
    const manualSenders = String(formData.get('manual_senders') || 'alert@indeed.com, jobalerts-noreply@linkedin.com');
    const manualKeywords = String(formData.get('manual_keywords') || 'Shopify, e-commerce, Liquid, SvelteKit, React');

    const env = {
      ...process.env,
      OVERRIDE_EXTRACT_LIMIT: String(manualLimit),
      OVERRIDE_SENDERS: manualSenders,
      OVERRIDE_KEYWORDS: manualKeywords
    };

    try {
      await execAsync('node scripts/gmail-ingest.js', { env });
      await execAsync('node scripts/playwright-extractor.js', { env });
      await execAsync('node scripts/ollama-client.js', { env });
      return {
        success: true,
        message: `Manual pipeline run completed (${manualLimit} max jobs)! Head to Job Hunter Feed to view your scored matches.`
      };
    } catch (err) {
      return { error: true, message: err.message || 'Error running pipeline' };
    }
  },

  optimizePromptWithGemini: async () => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return { error: true, message: 'GEMINI_API_KEY missing in .env file.' };
    }

    const appliedJobs = db.prepare(`
      SELECT title, score, reasoning FROM jobs WHERE COALESCE(applied, 0) = 1 ORDER BY id DESC LIMIT 15
    `).all();

    const trashedJobs = db.prepare(`
      SELECT title, score, reasoning, user_feedback FROM jobs WHERE COALESCE(trashed, 0) = 1 ORDER BY id DESC LIMIT 20
    `).all();

    if (appliedJobs.length === 0 && trashedJobs.length === 0) {
      return { error: true, message: 'Mark at least a few jobs as "Applied" or "Remove" on the Feed first!' };
    }

    const settings = db.prepare('SELECT custom_ollama_rules FROM settings WHERE id = 1').get();

    const geminiPrompt = `You are a Prompt Engineering Optimizer for a local Ollama job-scoring agent.
The candidate is a Senior Web Developer & Storefront Lead specializing in Shopify Plus, Liquid, modern e-commerce architecture, SvelteKit, React, Vue, and serverless Node.js/AWS integrations.

Here are the jobs the user ACTUALLY APPLIED FOR (Thumbs Up):
${JSON.stringify(appliedJobs, null, 2)}

Here are the jobs the user REMOVED/TRASHED (Thumbs Down, including feedback):
${JSON.stringify(trashedJobs, null, 2)}

Current Custom Rules:
${settings?.custom_ollama_rules || 'None yet.'}

Write a concise, bulleted list of 4 to 8 strict scoring rules to inject into Ollama's system prompt so it scores jobs like the "Applied" ones 9-10 and jobs like the "Trashed" ones 1-3.
Return ONLY the bulleted rules in plain text, no intro or outro.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt }] }]
          })
        }
      );

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error?.message || 'Gemini API request failed');
      }

      const newRules = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      if (newRules) {
        db.prepare('UPDATE settings SET custom_ollama_rules = ? WHERE id = 1').run(newRules);
      }

      return {
        success: true,
        message: 'Gemini analyzed your feedback and updated your Ollama scoring rules!'
      };
    } catch (err) {
      return { error: true, message: `Gemini Error: ${err.message}` };
    }
  }
};