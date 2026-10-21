import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'database', 'jobs.sqlite');
const RESUME_PATH = path.join(__dirname, '..', 'resume.md');
const MODEL_NAME = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';

const db = new Database(DB_PATH);

const resumeText = fs.existsSync(RESUME_PATH)
  ? fs.readFileSync(RESUME_PATH, 'utf-8')
  : 'Senior Web Developer & Storefront Lead specializing in Shopify Plus, Liquid, modern e-commerce architecture, SvelteKit, React, Vue.js, Node.js, and AWS Lambda serverless integrations.';

const argId = process.argv.find((a) => a.startsWith('--id='))?.split('=')[1];
const targetJobId = Number(argId || process.env.OVERRIDE_JOB_ID || 0);

const selectAllQueuedStmt = db.prepare(`
  SELECT id, title, company, description
  FROM jobs
  WHERE status = 'extracted'
  ORDER BY id DESC
`);

const selectSingleJobStmt = db.prepare(`
  SELECT id, title, company, description
  FROM jobs
  WHERE id = ?
`);

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

  console.log(
    targetJobId
      ? `[Ollama Priority] Evaluating single job ID #${targetJobId}...`
      : `Found ${jobs.length} queued jobs to evaluate.`
  );

  if (jobs.length === 0) return;

  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const minSalary = settings?.min_salary || 150000;
  const rawKeywords =
    process.env.OVERRIDE_KEYWORDS ??
    settings?.target_keywords ??
    'Shopify, e-commerce, Liquid, SvelteKit';
  const rawExcludes = settings?.exclude_keywords || '';

  const targetKeywords = rawKeywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const excludeKeywords = rawExcludes
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const customRules = settings?.custom_ollama_rules
    ? `\nADDITIONAL LEARNED SCORING RULES FROM USER FEEDBACK:\n${settings.custom_ollama_rules}\n`
    : '';

  for (const job of jobs) {
    const prompt = `You are a ruthless technical recruiter evaluating a job posting for a Senior Web Developer and Full-Stack Software Engineer.
The candidate specializes in enterprise e-commerce architecture, Shopify Plus storefront development, and serverless backend integrations (AWS Lambda, Node.js). They are highly proficient in Liquid, Remix, Vue.js, React, and SvelteKit. They are based near Denver, Colorado, and require a minimum salary of $${minSalary}.

CRITICAL SCORING RULES:
1. If the job is an entry-level position, a non-coding role, or clearly pays below $${minSalary}, YOU MUST SCORE IT 1 OR 2.
2. If the job requires fluent French, or is located entirely outside the US, score it a 1.
3. TARGET KEYWORDS TO BOOST: [${targetKeywords.join(', ')}]. If the job posting strongly features these technologies or domains, boost the score by +1 to +2 points (score 8, 9, or 10 if it is also a senior role).
4. EXCLUDE KEYWORDS TO PENALIZE: [${excludeKeywords.join(', ')}]. If the role centers on these, penalize the score heavily.
${customRules}

Job Title: ${job.title}
Job Posting:
${job.description}

Candidate Resume:
${resumeText}

Your response must match this exact JSON structure:
{
  "score": <number between 1 and 10>,
  "reasoning": "<string: detailed evaluation including matched target keywords, strengths, and weaknesses>",
  "cover_letter": "<string: ONLY draft a cover letter if the score is 9 or 10. If the score is 8 or below, leave this entirely empty.>",
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

      if (!response.ok) {
        throw new Error(`Ollama HTTP error ${response.status}`);
      }

      const data = await response.json();
      const parsedContent = JSON.parse(data.response);

      let score = Number(parsedContent.score) || 1;
      let reasoning = String(parsedContent.reasoning || '');
      const coverLetter = String(parsedContent.cover_letter || '');
      const cleanedDescription = String(parsedContent.cleaned_description || '');

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

      console.log(`Scored ${job.title}: ${score}/10`);
    } catch (error) {
      console.error(`Error processing job ID ${job.id} (${job.title}):`, error.message);
      if (targetJobId) throw error;
    }
  }

  console.log('Finished evaluating jobs.');
}

evaluateJobs().catch((err) => {
  console.error('Fatal error in evaluateJobs:', err);
  process.exit(1);
});