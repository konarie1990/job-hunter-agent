import cron from 'node-cron';
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gmailIngestPath = path.resolve(__dirname, 'gmail-ingest.js');
const playwrightExtractorPath = path.resolve(__dirname, 'playwright-extractor.js');
const ollamaClientPath = path.resolve(__dirname, 'ollama-client.js');

let isRunning = false;

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = fork(scriptPath);

    child.on('error', (err) => {
      reject(err);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script ${scriptPath} exited with code ${code}`));
      }
    });
  });
}

async function runPipeline() {
  if (isRunning) {
    console.log('[Scheduler] Previous pipeline run is still in progress. Skipping this iteration.');
    return;
  }

  isRunning = true;
  console.log(`[Scheduler] Starting pipeline run at ${new Date().toISOString()}...`);

  try {
    console.log('[Scheduler] Step 1: Running Gmail ingest...');
    await runScript(gmailIngestPath);
    console.log('[Scheduler] Step 1 finished: Gmail ingest completed.');

    console.log('[Scheduler] Step 2: Running Playwright extractor...');
    await runScript(playwrightExtractorPath);
    console.log('[Scheduler] Step 2 finished: Playwright extraction completed.');

    console.log('[Scheduler] Step 3: Running Ollama evaluator...');
    await runScript(ollamaClientPath);
    console.log('[Scheduler] Step 3 finished: Ollama evaluation completed.');

    console.log(`[Scheduler] Pipeline completed successfully at ${new Date().toISOString()}.`);
  } catch (error) {
    console.error('[Scheduler] Pipeline encountered an error:', error.message);
  } finally {
    isRunning = false;
  }
}

console.log('[Scheduler] Job Hunter scheduler booted successfully.');
console.log('[Scheduler] Scheduled to run hourly. Triggering initial run immediately...');

// Immediate initial run on boot
runPipeline();

// Schedule to run every hour (at minute 0)
cron.schedule('0 * * * *', () => {
  console.log('[Scheduler] Cron trigger activated.');
  runPipeline();
});
