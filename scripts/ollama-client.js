import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'database', 'jobs.sqlite');
const RESUME_PATH = path.join(__dirname, '..', 'resume.md');

const db = new Database(DB_PATH);

const settingsRow = db.prepare('SELECT ollama_model FROM settings WHERE id = 1').get();
const MODEL_NAME = settingsRow?.ollama_model || process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';

const argId = process.argv.find((a) => a.startsWith('--id='))?.split('=')[1];
const targetJobId = Number(argId || process.env.OVERRIDE_JOB_ID || 0);

const forceCoverLetter = process.argv.includes('--force-cover-letter') || process.env.FORCE_COVER_LETTER === 'true';

const coverLetterInstruction = forceCoverLetter
  ? '4. YOU MUST DRAFT A PROFESSIONAL, TAILORED COVER LETTER FOR THIS JOB REGARDLESS OF ITS SCORE.'
  : '4. ONLY draft a cover letter if the score is 9 or 10. If the score is 8 or below, leave this entirely empty.';

const selectAllQueuedStmt = db.prepare(`
  SELECT id, title, company, description, resume_version_id
  FROM jobs
  WHERE status = 'extracted'
  ORDER BY id DESC
`);

const selectSingleJobStmt = db.prepare(`
  SELECT id, title, company, description, resume_version_id
  FROM jobs
  WHERE id = ?
`);

const fallbackResume = fs.existsSync(RESUME_PATH)
  ? fs.readFileSync(RESUME_PATH, 'utf-8')
  : 'Senior Web Developer & Storefront Lead specializing in Shopify Plus, Liquid, SvelteKit, React, and Node.js.';

const updateJobStmt = db.prepare(`
  UPDATE jobs
  SET score = @score,
      reasoning = @reasoning,
      cover_letter = @cover_letter,
      cleaned_description = @cleaned_description,
      status = 'evaluated'
  WHERE id = @id
`);

async function evaluateJobs() {
  const jobs = targetJobId
    ? selectSingleJobStmt.all(targetJobId)
    : selectAllQueuedStmt.all();

  console.log(`[Ollama Client] Using model: ${MODEL_NAME}. Evaluating ${jobs.length} jobs.`);

  if (jobs.length === 0) return;

  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const minSalary = settings?.min_salary || 150000;
  const rawKeywords = process.env.OVERRIDE_KEYWORDS ?? settings?.target_keywords ?? 'Shopify, e-commerce, Liquid, SvelteKit';
  const rawExcludes = settings?.exclude_keywords || '';

  const targetKeywords = rawKeywords.split(',').map((k) => k.trim()).filter(Boolean);
  const excludeKeywords = rawExcludes.split(',').map((k) => k.trim()).filter(Boolean);

  const customRules = settings?.custom_ollama_rules
    ? `\nADDITIONAL LEARNED SCORING RULES FROM USER FEEDBACK:\n${settings.custom_ollama_rules}\n`
    : '';

  const latestResumeRow = db.prepare('SELECT id, content FROM resume_versions ORDER BY id DESC LIMIT 1').get();
  const defaultVersionId = latestResumeRow?.id || 1;
  const defaultResumeContent = latestResumeRow?.content || fallbackResume;

  for (const job of jobs) {
    let candidateResume = defaultResumeContent;
    if (job.resume_version_id) {
      const vRow = db.prepare('SELECT content FROM resume_versions WHERE id = ?').get(job.resume_version_id);
      if (vRow?.content) candidateResume = vRow.content;
    } else {
      db.prepare('UPDATE jobs SET resume_version_id = ? WHERE id = ?').run(defaultVersionId, job.id);
    }

    const prompt = `You are a ruthless technical recruiter evaluating a job posting for a Senior Web Developer and Full-Stack Software Engineer.
The candidate's credentials are provided in their resume below. They require a minimum salary of $${minSalary}.

CRITICAL SCORING RULES:
1. If the job is an entry-level position, a non-coding role, or clearly pays below $${minSalary}, YOU MUST SCORE IT 1 OR 2.
2. If the job requires fluent French, or is located entirely outside the US, score it a 1.
3. TARGET KEYWORDS TO BOOST: [${targetKeywords.join(', ')}]. If the job posting strongly features these technologies or domains, boost the score by +1 to +2 points (score 8, 9, or 10 if it is also a senior role).
${coverLetterInstruction}
${customRules}

Job Title: ${job.title}
Job Posting:
${job.description}

Candidate Resume:
${candidateResume}

Your response must match this exact JSON structure:
{
  "score": <number between 1 and 10>,
  "reasoning": "<string: detailed evaluation including matched target keywords, strengths, and weaknesses>",
  "cover_letter": "<string: tailored professional cover letter>",
  "cleaned_description": "<string: concise, clean, well-formatted markdown version of the job description removing headers, footers, and web scraper noise>"
}`;

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL_NAME,
          prompt,
          format: 'json',
          stream: false,
        }),
      });

      if (!response.ok) throw new Error(`Ollama HTTP error ${response.status}`);

      const data = await response.json();
      const parsedContent = JSON.parse(data.response);

      let score = Number(parsedContent.score) || job.score || 5;
      let reasoning = String(parsedContent.reasoning || '');
      const coverLetter = String(parsedContent.cover_letter || '');
      const cleanedDescription = String(parsedContent.cleaned_description || job.description || '');

      const haystack = `${job.title || ''} ${job.description || ''}`.toLowerCase();
      const matchedKeywords = targetKeywords.filter((kw) => haystack.includes(kw.toLowerCase()));

      if (matchedKeywords.length > 0 && score >= 5 && score < 10) {
        const boost = Math.min(2, matchedKeywords.length);
        const oldScore = score;
        score = Math.min(10, score + boost);
        if (score !== oldScore) {
          reasoning = `[Keyword Boost +${score - oldScore} for: ${matchedKeywords.join(', ')}] ` + reasoning;
        }
      }

      updateJobStmt.run({
        id: job.id,
        score,
        reasoning,
        cover_letter: coverLetter,
        cleaned_description: cleanedDescription,
      });

      console.log(`Evaluated/Generated cover letter for job ID ${job.id}`);
    } catch (error) {
      console.error(`Error processing job ID ${job.id}:`, error.message);
      if (targetJobId) throw error;
    }
  }

  console.log('Finished evaluation.');
}

evaluateJobs().catch((err) => {
  console.error('Fatal error in evaluateJobs:', err);
  process.exit(1);
});