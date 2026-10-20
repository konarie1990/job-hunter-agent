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

const settings = db.prepare('SELECT extract_limit FROM settings WHERE id = 1').get();
const EXTRACT_LIMIT = settings?.extract_limit || 10;

const selectPendingJobsStmt = db.prepare(`
  SELECT id, url
  FROM jobs
  WHERE status = 'pending'
  ORDER BY id DESC
  LIMIT ?
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

function getRandomDelay(minSeconds = 1.5, maxSeconds = 3.5) {
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
  const pendingJobs = selectPendingJobsStmt.all(EXTRACT_LIMIT);
  console.log(`[Playwright Extractor] Found ${pendingJobs.length} pending jobs to extract (Limit: ${EXTRACT_LIMIT}).`);

  if (pendingJobs.length === 0) {
    return;
  }

  const browserProfilePath = path.join(__dirname, '..', 'browser_profile');
  const browser = await chromium.launchPersistentContext(browserProfilePath, {
    headless: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  // SPEED OPTIMIZATION: Block images, fonts, and media across all pages
  await browser.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font'].includes(type)) {
      return route.abort();
    }
    return route.continue();
  });

  try {
    for (let i = 0; i < pendingJobs.length; i++) {
      const job = pendingJobs[i];
      console.log(`[Playwright Extractor] (${i + 1}/${pendingJobs.length}) Extracting: ${job.url}`);

      const page = await browser.newPage();

      try {
        await page.goto(job.url, {
          timeout: 20000,
          waitUntil: 'domcontentloaded',
        });

        await page.waitForTimeout(1200);

        const pageTitle = (await page.title()) || 'Untitled Position';

        if (pageTitle.includes('Sign in') || pageTitle.includes('Log In') || pageTitle.includes('Security Verification')) {
          console.warn('LOGIN WALL DETECTED! Please log into the visible browser window. Waiting 60 seconds...');
          await page.waitForTimeout(60000);
        }

        // Expand "Show more" on LinkedIn if folded
        await page.evaluate(() => {
          const btn = document.querySelector('.show-more-less-html__button--more, button[aria-label*="Click to see more description"]');
          if (btn) btn.click();
        }).catch(() => { });

        const result = await page.evaluate(() => {
          const rawBody = document.body ? document.body.innerText.toLowerCase() : '';
          const isClosed =
            rawBody.includes('no longer accepting applications') ||
            rawBody.includes('no longer available') ||
            rawBody.includes('this job is expired');

          if (isClosed) return { closed: true, text: '' };

          // Aggressively strip all non-job noise from DOM
          document.querySelectorAll(
            'header, footer, nav, aside, script, style, noscript, svg, button, ' +
            '.global-footer, .global-nav, #global-nav, [role="navigation"], ' +
            '.similar-jobs, .jobs-similar-jobs, .jobs-company, .jobs-poster, ' +
            '.job-view-layout > aside, .artdeco-card.ember-view:not(.jobs-description)'
          ).forEach((el) => el.remove());

          const selectors = [
            '.jobs-description__content',
            '.jobs-description-content__text',
            '.show-more-less-html__markup',
            '#job-details',
            '#jobDescriptionText',
            '.jobsearch-JobComponent-description',
            'article',
            'main'
          ];

          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.innerText.trim().length > 150) {
              return { closed: false, text: el.innerText };
            }
          }

          return { closed: false, text: document.body ? document.body.innerText : '' };
        });

        if (result.closed) {
          console.log(`[Playwright Extractor] Job ID ${job.id} is closed. Skipping.`);
          updateJobClosedStmt.run({ id: job.id });
        } else {
          const cleanedDescription = cleanText(result.text);

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
        const delay = getRandomDelay(1.5, 3.5);
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