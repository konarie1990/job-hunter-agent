import fs from 'fs';
import path from 'path';
import db from '../src/lib/db.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const selectJobsStmt = db.prepare("SELECT * FROM jobs WHERE status = 'extracted'");

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
  /** @type {Job[]} */
  const jobs = selectJobsStmt.all();
  console.log(`Found ${jobs.length} jobs to evaluate.`);

  for (const job of jobs) {
    const resumePath = path.join(__dirname, '..', 'resume.md');
    const resumeText = fs.readFileSync(resumePath, 'utf8');

    const settings = db.prepare('SELECT min_salary FROM settings WHERE id = 1').get();
    const minSalary = settings?.min_salary || 140000;

    const prompt = `You are a ruthless technical recruiter evaluating a job posting for a Senior Web Developer and Full-Stack Software Engineer. 
The candidate specializes in enterprise e-commerce architecture, Shopify Plus storefront development, and serverless backend integrations (AWS Lambda, Node.js). They are highly proficient in Liquid, Remix, Vue.js, React, and SvelteKit. They are based near Denver, Colorado, and require a minimum salary of $${minSalary}. Evaluate the following job posting against the candidate's resume. CRITICAL SCORING RULES: 1. If the job is an entry-level position, a non-coding role (like "Content Reviewer" or "Data Entry"), or clearly pays below $${minSalary} (e.g., hourly rates like \$14/hr), YOU MUST SCORE IT 1 OR 2.
2. If the job requires fluent French, or is located entirely outside the US, score it a 1.
3. Only score 8, 9, or 10 if the role is a senior-level software engineering or e-commerce development position.

Job Posting:
${job.description}

Candidate Resume:
${resumeText}

OUTPUT FORMAT REQUIREMENT:
You MUST respond entirely in valid JSON format. Do not use markdown blocks like \`\`\`json. Your response must match this exact structure:
{
  "score": <number between 1 and 10>,
  "reasoning": "<string: detailed evaluation including strengths and weaknesses>",
  "cover_letter": "<string: draft a compelling cover letter highlighting Shopify Plus and e-commerce architecture experience if the score is 8 or higher. Otherwise, leave empty.>",
  "cleaned_description": "<string: concise, clean, well-formatted markdown version of the job description removing headers, footers, and web scraper noise>"
}`;
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen2.5-coder:7b',
          format: 'json',
          stream: false,
          prompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const parsedContent = JSON.parse(data.response);

      const score = Number(parsedContent.score);
      const reasoning = String(parsedContent.reasoning || '');
      const coverLetter = String(parsedContent.cover_letter || '');
      const cleanedDescription = String(parsedContent.cleaned_description || '');

      updateJobStmt.run({
        id: job.id,
        score,
        reasoning,
        cover_letter: coverLetter,
        cleaned_description: cleanedDescription,
      });

      console.log(`Scored ${job.title} at ${job.company}: ${score}/10`);
    } catch (error) {
      console.error(`Error processing job ID ${job.id} (${job.title} at ${job.company}):`, error.message);
    }
  }

  console.log('Finished evaluating jobs.');
}

evaluateJobs();
