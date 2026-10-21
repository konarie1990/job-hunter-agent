import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const db = new Database(path.resolve('database/jobs.sqlite'));

function ensureSettingsColumns() {
  const existingCols = db.prepare('PRAGMA table_info(settings)').all().map((c) => c.name);
  if (!existingCols.includes('ollama_model')) {
    db.prepare("ALTER TABLE settings ADD COLUMN ollama_model TEXT DEFAULT 'qwen2.5-coder:7b'").run();
  }
}
ensureSettingsColumns();

// Helper to query local Ollama models
async function fetchLocalOllamaModels() {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    if (res.ok) {
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        return data.models.map((m) => m.name);
      }
    }
  } catch {
    // Ollama might not be running or reachable at moment of load
  }
  return ['qwen2.5-coder:7b', 'llama3:8b', 'phi3:3.5b'];
}

export async function load() {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();

  // Load resume versions history
  const resumeVersions = db.prepare('SELECT * FROM resume_versions ORDER BY id DESC').all();
  const activeResume = resumeVersions[0] || { id: null, content: '# No resume found in vault' };

  let schedules = [];
  try {
    schedules = settings?.schedules ? JSON.parse(settings.schedules) : [];
  } catch {
    schedules = [];
  }

  const feedbackCounts = db.prepare(`
    SELECT 
      SUM(CASE WHEN COALESCE(applied, 0) = 1 THEN 1 ELSE 0 END) as applied_count,
      SUM(CASE WHEN COALESCE(trashed, 0) = 1 THEN 1 ELSE 0 END) as trashed_count
    FROM jobs
  `).get();

  const availableModels = await fetchLocalOllamaModels();

  return {
    settings,
    schedules,
    resumeVersions,
    activeResume,
    availableModels,
    feedbackCounts
  };
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
    const ollama_model = String(formData.get('ollama_model') || 'qwen2.5-coder:7b');
    const gemini_model = String(formData.get('gemini_model') || 'gemini-3.8-flash');

    let parsedSchedules = [];
    try {
      parsedSchedules = JSON.parse(schedulesJson);
    } catch {
      parsedSchedules = [];
    }

    const primary = parsedSchedules[0] || {};

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
          schedules = ?,
          ollama_model = ?,
          gemini_model = ?
      WHERE id = 1
    `).run(
      min_salary, remote, hybrid, onsite,
      primary.target_keywords || '', exclude_keywords,
      primary.target_senders || 'alert@indeed.com, jobalerts-noreply@linkedin.com',
      blocked_senders, Number(primary.extract_limit) || 10,
      gmail_days, custom_ollama_rules, JSON.stringify(parsedSchedules), ollama_model, gemini_model
    );

    return { success: true, message: 'Settings, Ollama & Gemini model selections saved!' };
  },

  saveNewResumeVersion: async ({ request }) => {
    const formData = await request.formData();
    const content = String(formData.get('resume_content') || '').trim();

    if (!content) {
      return { error: true, message: 'Resume content cannot be empty.' };
    }

    db.prepare('INSERT INTO resume_versions (content) VALUES (?)').run(content);
    return { success: true, message: 'New immutable resume version saved to vault!' };
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
      return { success: true, message: 'Manual pipeline run completed successfully!' };
    } catch (err) {
      return { error: true, message: err.message || 'Error running pipeline' };
    }
  },

  optimizePromptWithGemini: async () => {
    let apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      try {
        const envPath = path.resolve('..', '.env');
        const envContent = fs.readFileSync(envPath, 'utf-8');
        for (const line of envContent.split('\n')) {
          if (line.startsWith('GEMINI_API_KEY=')) {
            apiKey = line.split('=')[1].trim().replace(/['"]/g, '');
            break;
          }
        }
      } catch {
        // ignore
      }
    }

    if (!apiKey) {
      return {
        error: true,
        message: 'GEMINI_API_KEY missing. Check your root .env file.'
      };
    }

    // Read selected Gemini model from database (default to gemini-3.8-flash)
    const settings = db.prepare('SELECT gemini_model, custom_ollama_rules FROM settings WHERE id = 1').get();
    const geminiModel = settings?.gemini_model || 'gemini-3.8-flash';

    const appliedJobs = db.prepare('SELECT title, score, reasoning FROM jobs WHERE COALESCE(applied, 0) = 1 ORDER BY id DESC LIMIT 15').all();
    const trashedJobs = db.prepare('SELECT title, score, reasoning, user_feedback FROM jobs WHERE COALESCE(trashed, 0) = 1 ORDER BY id DESC LIMIT 20').all();

    if (appliedJobs.length === 0 && trashedJobs.length === 0) {
      return { error: true, message: 'Mark at least a few jobs as Applied or Removed first!' };
    }

    const geminiPrompt = `You are a Prompt Engineering Optimizer for a local Ollama job-scoring agent.
Here are the jobs the user APPLIED FOR: ${JSON.stringify(appliedJobs)}
Here are the jobs the user REMOVED: ${JSON.stringify(trashedJobs)}
Current Rules: ${settings?.custom_ollama_rules || 'None.'}
Write 4 to 8 strict scoring rules as bullet points. Return ONLY plain text bullet points.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: geminiPrompt }] }] })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || 'Gemini API failed');

      const newRules = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      if (newRules) db.prepare('UPDATE settings SET custom_ollama_rules = ? WHERE id = 1').run(newRules);

      return { success: true, message: `Gemini (${geminiModel}) optimized your Ollama scoring rules!` };
    } catch (err) {
      return { error: true, message: `Gemini Error: ${err.message}` };
    }
  }
};