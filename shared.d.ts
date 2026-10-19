export interface SearchSettings {
  id: number;
  min_salary: number;
  work_model: 'remote' | 'hybrid' | 'onsite';
  exclude_keywords: string;
}

export interface Job {
  id: number;
  job_url: string;
  company: string;
  title: string;
  salary_range: string;
  description: string;
  cover_letter: string;
  score: number;
  reasoning: string;
  scraped_at: string;
  status: 'pending_review' | 'applied' | 'rejected';
}
