CREATE TABLE IF NOT EXISTS search_settings (
  id INTEGER PRIMARY KEY,
  min_salary INTEGER NOT NULL,
  work_model TEXT CHECK(work_model IN ('remote', 'hybrid', 'onsite')) NOT NULL,
  exclude_keywords TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY,
  job_url TEXT NOT NULL UNIQUE,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  salary_range TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_letter TEXT,
  score REAL,
  reasoning TEXT,
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  status TEXT CHECK(status IN ('pending_review', 'applied', 'rejected')) NOT NULL DEFAULT 'pending_review'
);

CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL, -- 'google_api', 'ats_endpoint', 'rss_feed'
    query_url TEXT NOT NULL,   -- The actual URL or the search string
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);