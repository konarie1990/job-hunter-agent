import { fetch } from 'node-fetch';
import db from '#lib/db.js';

async function evaluateJobs() {
  /** @type {Job[]} */
  const jobs = selectJobsStmt.all();
  console.log(`Found ${jobs.length} jobs to evaluate.`);

  for (const job of jobs) {
    const resumePath = path.join(__dirname, '..', 'resume.md');
    const resumeText = fs.readFileSync(resumePath, 'utf8');

    const prompt = `You are an expert technical recruiter. Evaluate this job posting against the candidate's resume. The job posting is as follows:\n\n${job.description}\n\nThe candidate's resume is as follows:\n\n${resumeText}\n\nPlease provide a detailed evaluation of the candidate's suitability for the job, including their strengths, weaknesses, and any relevant experience or skills. Provide a score out of 10 and a brief reasoning for your evaluation.`;
    // Rest of the code...
  }
}
