CREATE TABLE IF NOT EXISTS search_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  min_salary INTEGER NOT NULL,
  work_model TEXT CHECK(work_model IN ('remote', 'hybrid', 'onsite')) NOT NULL,
  exclude_keywords TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_url TEXT NOT NULL,
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
