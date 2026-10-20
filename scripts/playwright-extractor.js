import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(stealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'database', 'jobs.sqlite');
const db = new Database(DB_PATH);

const selectPendingJobsStmt = db.prepare(`
  SELECT id, url
  FROM jobs
  WHERE status = 'pending'
  ORDER BY id ASC
  LIMIT 50
`);

const updateJobSuccessStmt = db.prepare(`
  UPDATE jobs
  SET title = @title,
      description = @description,
      status = 'extracted'
  WHERE id = @id
`);

const updateJobClosedStmt = db.prepare(`
  UPDATE jobs
  SET status = 'closed'
  WHERE id = @id
`);

const updateJobFailedStmt = db.prepare(`
  UPDATE jobs
  SET status = 'failed'
  WHERE id = @id
`);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelay(minSeconds = 3, maxSeconds = 7) {
  const min = minSeconds * 1000;
  const max = maxSeconds * 1000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

async function extractPendingJobs() {
  /** @type {{ id: number, url: string }[]} */
  const pendingJobs = selectPendingJobsStmt.all();
  console.log(`[Playwright Extractor] Found ${pendingJobs.length} pending jobs to extract.`);

  if (pendingJobs.length === 0) {
    return;
  }

  const browserProfilePath = path.join(__dirname, '..', 'browser_profile');
  const browser = await chromium.launchPersistentContext(browserProfilePath, { headless: false, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' });

  try {
    for (let i = 0; i < pendingJobs.length; i++) {
      const job = pendingJobs[i];
      console.log(`[Playwright Extractor] (${i + 1}/${pendingJobs.length}) Extracting: ${job.url}`);

      const page = await browser.newPage();

      try {
        await page.goto(job.url, {
          timeout: 30000,
          waitUntil: 'domcontentloaded',
        });

        // Wait for redirects to login walls to complete
        await page.waitForTimeout(2000);

        const pageTitle = (await page.title()) || 'Untitled Position';

        if (pageTitle.includes('Sign in') || pageTitle.includes('Log In') || pageTitle.includes('Security Verification')) {
          console.warn('LOGIN WALL DETECTED! Please log into the visible browser window. Waiting 60 seconds...');
          await page.waitForTimeout(60000);
        }

        const isClosed = await page.evaluate(() => {
          const bodyText = document.body ? document.body.innerText : '';
          const lowerText = bodyText.toLowerCase();
          return lowerText.includes('no longer accepting applications') || lowerText.includes('no longer available');
        });

        if (isClosed) {
          console.log(`[Playwright Extractor] Job ID ${job.id} is closed (no longer accepting applications / available).`);
          updateJobClosedStmt.run({ id: job.id });
        } else {
          const bodyText = await page.evaluate(() => {
            // Remove junk elements before reading content
            document
              .querySelectorAll('header, footer, nav, aside, .global-footer, .global-nav, #global-nav, [role="navigation"]')
              .forEach((el) => el.remove());

            // Target core job containers
            const container = document.querySelector(
              '.jobs-description-content__text, #job-details, article, .job-view-layout, #jobDescriptionText'
            );

            if (container) {
              return container.innerText;
            }

            return document.body ? document.body.innerText : '';
          });
          const cleanedDescription = cleanText(bodyText);

          updateJobSuccessStmt.run({
            id: job.id,
            title: pageTitle.trim(),
            description: cleanedDescription,
          });

          console.log(`[Playwright Extractor] Successfully extracted job ID ${job.id}: "${pageTitle.trim()}"`);
        }
      } catch (err) {
        console.error(`[Playwright Extractor] Failed to extract job ID ${job.id} (${job.url}):`, err.message);
        updateJobFailedStmt.run({ id: job.id });
      } finally {
        await page.close().catch(() => { });
      }

      if (i < pendingJobs.length - 1) {
        const delay = getRandomDelay(3, 7);
        console.log(`[Playwright Extractor] Waiting ${(delay / 1000).toFixed(1)}s before next request...`);
        await sleep(delay);
      }
    }
  } finally {
    await browser.close();
    console.log('[Playwright Extractor] Extraction run complete. Browser closed.');
  }
}

extractPendingJobs().catch((err) => {
  console.error('[Playwright Extractor] Fatal execution error:', err);
  process.exit(1);
});
