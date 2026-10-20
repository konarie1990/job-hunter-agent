import Database from 'better-sqlite3';

const db = new Database('database/jobs.sqlite');

async function runScraper() {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const includeList = settings?.include_keywords ? settings.include_keywords.toLowerCase().split(',').map(k => k.trim()).filter(k => k) : [];
  const excludeList = settings?.exclude_keywords ? settings.exclude_keywords.toLowerCase().split(',').map(k => k.trim()).filter(k => k) : [];
  console.log('[Scraper] Fetching active sources from database...');
  const sources = db.prepare('SELECT * FROM sources WHERE is_active = 1').all();

  for (const source of sources) {
    console.log(`[Scraper] Requesting data from: ${source.query_url}`);

    try {
      const response = await fetch(source.query_url);
      const data = await response.json();

      // 1. Parse Remotive JSON (US Only)
      if (source.query_url.includes('remotive.com')) {
        const insert = db.prepare('INSERT OR IGNORE INTO jobs (url, title, company, description) VALUES (?, ?, ?, ?)');
        let count = 0;
        for (const job of data.jobs) {
          const loc = (job.candidate_required_location || '').toLowerCase();

          // 1. Strict US-Only Location Check
          if (loc === 'usa' || loc.includes('us ') || loc.includes('united states') || loc === 'us') {

            const fullText = (job.title + " " + (job.description || '')).toLowerCase();

            // 2. Strict Inclusion Check
            if (includeList.length > 0 && !includeList.some(keyword => fullText.includes(keyword))) {
              continue;
            }

            // 3. Strict Exclusion & Language Check
            const isFrench = fullText.includes('ingénieur') || fullText.includes('français') || fullText.includes('marketing digital');
            if (isFrench || excludeList.some(keyword => fullText.includes(keyword))) {
              continue;
            }

            // Save if it passes all filters
            insert.run(job.url, job.title, job.company_name, job.description);
            console.log(`[Scraper] Saved: ${job.title} at ${job.company_name}`);
            count++;
          }
        }
        console.log(`[Scraper] Total US-based, relevant jobs saved from Remotive: ${count}`);
      }

      // 2. Parse Arbeitnow JSON (US Only)
      else if (source.query_url.includes('arbeitnow.com')) {
        const insert = db.prepare('INSERT OR IGNORE INTO jobs (url, title, company, description) VALUES (?, ?, ?, ?)');
        let count = 0;
        for (const job of data.data) {
          const loc = (job.location || '').toLowerCase();

          // 1. Strict US-Only Location Check
          if (loc.includes('us') || loc.includes('united states') || loc.includes('remote - usa')) {

            const fullText = (job.title + " " + (job.description || '')).toLowerCase();

            // 2. Strict Inclusion Check
            if (includeList.length > 0 && !includeList.some(keyword => fullText.includes(keyword))) {
              continue;
            }

            // 3. Strict Exclusion & Language Check
            const isFrench = fullText.includes('ingénieur') || fullText.includes('français') || fullText.includes('marketing digital');
            if (isFrench || excludeList.some(keyword => fullText.includes(keyword))) {
              continue;
            }

            // Save if it passes all filters
            insert.run(job.url, job.title, job.company_name, job.description);
            console.log(`[Scraper] Saved: ${job.title} at ${job.company_name}`);
            count++;
          }
        }
        console.log(`[Scraper] Total US-based, relevant jobs saved from Arbeitnow: ${count}`);
      }

    } catch (error) {
      console.error(`[Scraper] Failed to process ${source.query_url}:`, error.message);
    }
  }
  console.log('[Scraper] API ingestion complete.');
}

runScraper();