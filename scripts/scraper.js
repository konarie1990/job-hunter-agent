/**
 * @typedef {import('../shared.d.ts').Job} Job
 * @typedef {import('../shared.d.ts').SearchSettings} SearchSettings
 */

import db from '../src/lib/db.js';
import { PlaywrightCrawler } from 'crawlee';

/** @type {SearchSettings | undefined} */
const settings = db.prepare('SELECT * FROM search_settings WHERE id = 1').get();

const excludeKeywords = settings?.exclude_keywords
  ? settings.exclude_keywords
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
  : [];

const workModel = settings?.work_model || 'remote';

const insertJobStmt = db.prepare(`
  INSERT OR IGNORE INTO jobs (
    job_url, company, title, salary_range, description, status
  ) VALUES (
    @job_url, @company, @title, @salary_range, @description, 'pending_review'
  )
`);

const startUrl = 'https://www.bing.com/search?q=site:boards.greenhouse.io+OR+site:jobs.lever.co+"Shopify"';

const crawler = new PlaywrightCrawler({
  headless: false, // Opens a real browser window so you can see the DDG page!
  preNavigationHooks: [
    async ({ page }) => {
      // Masquerade as a standard Mac Chrome user
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
    }
  ],
  async requestHandler({ request, page, enqueueLinks, log }) {
    log.info(`Processing: ${request.url}`);

    if (request.url.includes('bing.com')) {
      await enqueueLinks({
        selector: 'a',
        transformRequestFunction(req) {
          try {
            // Extract the actual URL from Bing's search results
            const urlObj = new URL(req.url);
            if (urlObj.searchParams.has('q')) {
              const query = urlObj.searchParams.get('q');
              if (query.includes('boards.greenhouse.io') || query.includes('jobs.lever.co')) {
                return req;
              }
            }
          } catch (e) { }
          return false;
        },
      });
      return;
    }

    const jobData = await page.evaluate(() => {
      let title = '';
      let company = '';
      let salaryRange = 'Not listed';
      let description = '';

      const url = window.location.href;

      if (url.includes('boards.greenhouse.io')) {
        title =
          document.querySelector('h1.app-title')?.textContent?.trim() ||
          document.querySelector('.app-title')?.textContent?.trim() ||
          document.querySelector('h1')?.textContent?.trim() ||
          '';

        company =
          document.querySelector('span.company-name')?.textContent?.trim() ||
          document.querySelector('.company-name')?.textContent?.trim() ||
          '';

        description =
          document.querySelector('#content')?.textContent?.trim() ||
          document.body.innerText ||
          '';
      } else if (url.includes('jobs.lever.co')) {
        title =
          document.querySelector('.posting-headline h2')?.textContent?.trim() ||
          document.querySelector('h2')?.textContent?.trim() ||
          '';

        company =
          document.querySelector('.main-header-logo img')?.getAttribute('alt')?.trim() ||
          document.title.split('-')[1]?.trim() ||
          '';

        description =
          document.querySelector('.posting-sections')?.textContent?.trim() ||
          document.querySelector('.content')?.textContent?.trim() ||
          document.body.innerText ||
          '';
      } else {
        title = document.querySelector('h1')?.textContent?.trim() || document.title || '';
        description = document.body.innerText || '';
      }

      if (!company) {
        const titleParts = document.title.split(/[-–|]/);
        if (titleParts.length > 1) {
          company = titleParts[titleParts.length - 1].trim();
        }
      }

      const salaryRegex = /(?:\$|USD\s*)\d{2,3}(?:,\d{3})*(?:\s*(?:k|K))?(?:\s*(?:-|to)\s*(?:\$|USD\s*)?\d{2,3}(?:,\d{3})*(?:\s*(?:k|K))?)?/i;
      const salaryMatch = description.match(salaryRegex);
      if (salaryMatch) {
        salaryRange = salaryMatch[0];
      }

      return {
        title,
        company,
        salaryRange,
        description,
      };
    });

    const fullTextToCheck = `${jobData.title} ${jobData.description}`.toLowerCase();

    for (const keyword of excludeKeywords) {
      if (fullTextToCheck.includes(keyword)) {
        log.info(`Skipping job (${request.url}): matched excluded keyword "${keyword}"`);
        return;
      }
    }

    try {
      insertJobStmt.run({
        job_url: request.url,
        company: jobData.company || 'Unknown',
        title: jobData.title || 'Untitled',
        salary_range: jobData.salaryRange,
        description: jobData.description,
      });
      log.info(`Saved job: ${jobData.title} at ${jobData.company}`);
    } catch (err) {
      log.error(`Failed to save job ${request.url}: ${err.message}`);
    }
  },
});

await crawler.run(startUrl);
