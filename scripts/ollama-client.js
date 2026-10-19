const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const db = require('../src/lib/db.js');

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
    const resumePath = path.join(__dirname, '..', 'resume.md');
    const resumeText = fs.readFileSync(resumePath, 'utf8');

    const prompt = `You are an expert technical recruiter. Evaluate this job posting against the candidate's provided resume. Resume: ${resumeText}. Job Title: ${job.title}. Company: ${job.company}. Description: ${job.description}. Return a JSON object with exactly three keys: 'score' (an integer from 1 to 10 based strictly on how well the job requirements align with the candidate's resume experience), 'reasoning' (1-2 sentences explaining the score based on specific resume matches or gaps), and 'cover_letter' (a 3-paragraph cover letter tailored to this specific job that explicitly highlights overlapping projects, e-commerce architecture experience, and technologies from the resume).`;

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
