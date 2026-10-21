import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import Database from 'better-sqlite3';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const db = new Database(path.join(PROJECT_ROOT, 'database', 'jobs.sqlite'));

const DEFAULT_SCHEDULES = [
  {
    id: 'morning-mst',
    name: 'Morning Fast Scan',
    time: '06:00',
    enabled: true,
    extract_limit: 10,
    target_senders: 'alert@indeed.com, jobalerts-noreply@linkedin.com',
    target_keywords: 'Shopify, e-commerce, Liquid, SvelteKit, React'
  },
  {
    id: 'evening-mst',
    name: 'Evening Deep Scan',
    time: '20:00',
    enabled: true,
    extract_limit: 25,
    target_senders: 'alert@indeed.com, jobalerts-noreply@linkedin.com',
    target_keywords: 'Shopify, e-commerce, Liquid, SvelteKit, React'
  }
];

function ensureDefaultSchedules() {
  const row = db.prepare('SELECT schedules FROM settings WHERE id = 1').get();
  if (!row?.schedules) {
    db.prepare('UPDATE settings SET schedules = ? WHERE id = 1').run(JSON.stringify(DEFAULT_SCHEDULES));
    console.log('[Scheduler] Initialized default 6:00 AM and 8:00 PM Mountain Time schedules.');
  }
}

let isRunning = false;
let lastTriggeredKey = '';

async function runPipelineForSchedule(sched) {
  if (isRunning) {
    console.log(`[Scheduler] Pipeline already running. Skipping "${sched.name}".`);
    return;
  }

  isRunning = true;
  console.log(`[Scheduler] 🚀 Starting Scheduled Job "${sched.name}" (${sched.time} MT | Max Jobs: ${sched.extract_limit})...`);

  const env = {
    ...process.env,
    OVERRIDE_EXTRACT_LIMIT: String(sched.extract_limit || 10),
    OVERRIDE_SENDERS: String(sched.target_senders || ''),
    OVERRIDE_KEYWORDS: String(sched.target_keywords || '')
  };

  try {
    console.log('[Scheduler] Step 1: Running Gmail ingest...');
    const { stdout: out1 } = await execAsync('node scripts/gmail-ingest.js', { cwd: PROJECT_ROOT, env });
    if (out1) console.log(out1.trim());

    console.log('[Scheduler] Step 2: Running Playwright extractor...');
    const { stdout: out2 } = await execAsync('node scripts/playwright-extractor.js', { cwd: PROJECT_ROOT, env });
    if (out2) console.log(out2.trim());

    console.log('[Scheduler] Step 3: Running Ollama evaluator...');
    const { stdout: out3 } = await execAsync('node scripts/ollama-client.js', { cwd: PROJECT_ROOT, env });
    if (out3) console.log(out3.trim());

    console.log(`[Scheduler] ✅ Completed "${sched.name}" at ${new Date().toISOString()}`);
  } catch (err) {
    console.error(`[Scheduler] ❌ Error during "${sched.name}":`, err.message);
  } finally {
    isRunning = false;
  }
}

function checkSchedules() {
  try {
    const row = db.prepare('SELECT schedules FROM settings WHERE id = 1').get();
    const schedules = row?.schedules ? JSON.parse(row.schedules) : DEFAULT_SCHEDULES;

    // Get current HH:MM in America/Denver (MST/MDT)
    const nowMT = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Denver',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());

    const todayDate = new Date().toLocaleDateString('en-US', { timeZone: 'America/Denver' });

    for (const sched of schedules) {
      if (!sched.enabled) continue;
      const triggerKey = `${todayDate}-${sched.id}-${sched.time}`;
      if (sched.time === nowMT && lastTriggeredKey !== triggerKey) {
        lastTriggeredKey = triggerKey;
        runPipelineForSchedule(sched);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Failed checking schedules:', err.message);
  }
}

ensureDefaultSchedules();
console.log('[Scheduler] Active and monitoring Mountain Time (America/Denver) schedules every 30s.');
setInterval(checkSchedules, 30000);