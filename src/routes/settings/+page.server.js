import Database from 'better-sqlite3';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const db = new Database(path.resolve('database/jobs.sqlite'));

export function load() {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const feedbackCounts = db.prepare(`
    SELECT 
      SUM(CASE WHEN COALESCE(applied, 0) = 1 THEN 1 ELSE 0 END) as applied_count,
      SUM(CASE WHEN COALESCE(trashed, 0) = 1 THEN 1 ELSE 0 END) as trashed_count
    FROM jobs
  `).get();

  return { settings, feedbackCounts };
}

export const actions = {
  saveSettings: async ({ request }) => {
    const formData = await request.formData();
    const min_salary = Number(formData.get('min_salary')) || 150000;
    const remote = formData.get('remote') === 'on' ? 1 : 0;
    const hybrid = formData.get('hybrid') === 'on' ? 1 : 0;
    const onsite = formData.get('onsite') === 'on' ? 1 : 0;
    const target_keywords = String(formData.get('target_keywords') || '');
    const exclude_keywords = String(formData.get('exclude_keywords') || '');
    const target_senders = String(formData.get('target_senders') || 'alert@indeed.com, jobalerts-noreply@linkedin.com');
    const blocked_senders = String(formData.get('blocked_senders') || '');
    const extract_limit = Number(formData.get('extract_limit')) || 10;
    const gmail_days = Number(formData.get('gmail_days')) || 1;
    const custom_ollama_rules = String(formData.get('custom_ollama_rules') || '');

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
          custom_ollama_rules = ?
      WHERE id = 1
    `).run(
      min_salary, remote, hybrid, onsite,
      target_keywords, exclude_keywords,
      target_senders, blocked_senders,
      extract_limit, gmail_days,
      custom_ollama_rules
    );

    return { success: true, message: 'Settings & prompt rules saved!' };
  },

  runManualPipeline: async () => {
    try {
      await execAsync('node scripts/gmail-ingest.js');
      await execAsync('node scripts/playwright-extractor.js');
      await execAsync('node scripts/ollama-client.js');
      return { success: true, message: 'Pipeline finished! Head to the Dashboard to view your top matches.' };
    } catch (err) {
      return { error: true, message: err.message || 'Error running pipeline' };
    }
  },

  optimizePromptWithGemini: async () => {
    // Read key from process.env (or fallback to your environment variable)
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return { error: true, message: 'GEMINI_API_KEY missing in environment variables.' };
    }

    const appliedJobs = db.prepare(`
      SELECT title, score, reasoning FROM jobs WHERE COALESCE(applied, 0) = 1 ORDER BY id DESC LIMIT 15
    `).all();

    const trashedJobs = db.prepare(`
      SELECT title, score, reasoning, user_feedback FROM jobs WHERE COALESCE(trashed, 0) = 1 ORDER BY id DESC LIMIT 20
    `).all();

    if (appliedJobs.length === 0 && trashedJobs.length === 0) {
      return { error: true, message: 'Mark at least a few jobs as "Applied" or "Remove" on the Dashboard first!' };
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