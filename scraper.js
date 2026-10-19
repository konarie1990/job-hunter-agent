import { fetch } from 'node-fetch';
import db from '#lib/db.js';

async function evaluateJobs() {
  /** @type {Job[]} */
  const jobs = selectJobsStmt.all();
  console.log(`Found ${jobs.length} jobs to evaluate.`);

  for (const job of jobs) {
    const resumePath = path.join(__dirname, '..', 'resume.md');
    const resumeText = fs.readFileSync(resumePath, 'utf8');

    const prompt = `You are an expert technical recruiter. Evaluate this job posting against the ca
