/**
 * @typedef {import('../shared.d.ts').Job} Job
 */

import db from '../src/lib/db.js';

const selectJobsStmt = db.prepare(`
  SELECT * FROM jobs
  WHERE status = 'pending_review' AND score IS NULL
`);

const updateJobStmt = db.prepare(`
  UPDATE jobs
  SET score = @score,
      reasoning = @reasoning,
      cover_letter = @cover_letter
  WHERE id = @id
`);

async function evaluateJobs() {
  /** @type {Job[]} */
  const jobs = selectJobsStmt.all();
  console.log(`Found ${jobs.length} jobs to evaluate.`);

  for (const job of jobs) {
    const prompt = `You are an expert technical recruiter. Evaluate this job posting for a Senior E-commerce Web Developer who specializes in Shopify Plus, Liquid, Node.js, and modern frontend frameworks. Job Title: ${job.title}. Company: ${job.company}. Description: ${job.description}. Return a JSON object with exactly three keys: 'score' (an integer from 1 to 10 based on how well it matches a Senior Shopify Developer profile), 'reasoning' (a 1-2 sentence explanation of the score), and 'cover_letter' (a brief, 3-paragraph tailored cover letter highlighting 4.5 years of Shopify and e-commerce experience).`;

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

      updateJobStmt.run({
        id: job.id,
        score,
        reasoning,
        cover_letter: coverLetter,
      });

      console.log(`Scored ${job.title} at ${job.company}: ${score}/10`);
    } catch (error) {
      console.error(`Error processing job ID ${job.id} (${job.title} at ${job.company}):`, error.message);
    }
  }

  console.log('Finished evaluating jobs.');
}

evaluateJobs();
