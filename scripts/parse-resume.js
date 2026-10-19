const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const db = require('../src/lib/db');

async function parseResume() {
  const resumePath = path.join(__dirname, '..', 'resume.md');
  const resumeContent = fs.readFileSync(resumePath, 'utf8');

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen2.5-coder:7b',
        mode: 'json',
        prompt: "Analyze this Senior E-commerce Developer resume. Return a JSON object with a single key 'keywords' containing an array of 15 highly specific technical keywords (like Shopify Plus, Liquid, Remix, AWS Lambda) extracted from the text.",
        input: resumeContent,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const keywords = data.keywords.join(',');

    const updateStmt = db.prepare('UPDATE search_settings SET exclude_keywords = ? WHERE id = 1');
    updateStmt.run(keywords);

    console.log('Keywords updated successfully.');
  } catch (error) {
    console.error('Error parsing resume:', error);
  }
}

parseResume();
