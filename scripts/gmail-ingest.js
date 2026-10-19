import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = path.join(__dirname, '..', 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');
const DB_PATH = path.join(__dirname, '..', 'database', 'jobs.sqlite');

const db = new Database(DB_PATH);

const insertJobStmt = db.prepare(`
  INSERT OR IGNORE INTO jobs (url, title, company, description, status)
  VALUES (?, ?, ?, ?, 'pending')
`);

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf8');
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload, 'utf8');
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }

  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  if (client.credentials) {
    await saveCredentials(client);
  }

  return client;
}

function decodeBase64Url(data) {
  if (!data) return '';
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function extractTextFromPayload(payload) {
  let text = '';

  if (!payload) return text;

  if (payload.body && payload.body.data) {
    text += `${decodeBase64Url(payload.body.data)}\n`;
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      text += `${extractTextFromPayload(part)}\n`;
    }
  }

  return text;
}

function extractJobUrls(content) {
  const urls = new Set();
  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const matches = content.match(urlRegex) || [];

  for (const rawUrl of matches) {
    try {
      const decodedUrl = rawUrl.replace(/&amp;/g, '&');
      const parsed = new URL(decodedUrl);

      const isIndeed =
        parsed.hostname.includes('indeed.com') &&
        parsed.pathname.includes('/viewjob');

      const isLinkedIn =
        parsed.hostname.includes('linkedin.com') &&
        parsed.pathname.includes('/jobs/view');

      if (isIndeed || isLinkedIn) {
        urls.add(parsed.href);
      }
    } catch {
      // Ignore invalid URLs
    }
  }

  return Array.from(urls);
}

async function ingestGmailAlerts() {
  console.log('[Gmail Ingest] Authenticating with Google...');
  const auth = await authorize();
  const gmail = google.gmail({ version: 'v1', auth });

  const settings = db.prepare('SELECT target_senders, blocked_senders FROM settings WHERE id = 1').get();
  const targetSenders = settings.target_senders.split(',').map(sender => sender.trim());
  const blockedSenders = settings.blocked_senders.split(',').map(sender => sender.trim());

  const query = `from:(${targetSenders.map(sender => sender.includes('@') ? sender : `@${sender}`)}.com) newer_than:30d`;
  console.log(`[Gmail Ingest] Querying messages with filter: "${query}"...`);

  let pageToken = undefined;
  let totalProcessedMessages = 0;
  let totalExtractedUrls = 0;

  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      pageToken,
    });

    const messages = listRes.data.messages || [];
    pageToken = listRes.data.nextPageToken;

    if (messages.length === 0) {
      console.log('[Gmail Ingest] No messages found matching query.');
      break;
    }

    console.log(`[Gmail Ingest] Processing batch of ${messages.length} messages...`);

    for (const messageMeta of messages) {
      try {
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: messageMeta.id,
          format: 'full',
        });

        const payload = msgRes.data.payload;
        const bodyContent = extractTextFromPayload(payload);
        const jobUrls = extractJobUrls(bodyContent);

        let insertedCount = 0;
        for (const jobUrl of jobUrls) {
          const cleanUrl = jobUrl.split('?')[0];
          const result = insertJobStmt.run(
            cleanUrl,
            'Pending Playwright Extraction',
            'Pending Playwright Extraction',
            'Pending Playwright Extraction'
          );
          if (result.changes > 0) {
            insertedCount += 1;
          }
        }

        totalExtractedUrls += jobUrls.length;
        console.log(
          `[Gmail Ingest] Message ${messageMeta.id}: extracted ${jobUrls.length} URLs (${insertedCount} new).`
        );

        await gmail.users.messages.modify({
          userId: 'me',
          id: messageMeta.id,
          requestBody: {
            removeLabelIds: ['UNREAD'],
          },
        });

        totalProcessedMessages += 1;
      } catch (err) {
        console.error(`[Gmail Ingest] Error processing message ${messageMeta.id}:`, err.message);
      }
    }
  } while (pageToken);

  console.log(
    `[Gmail Ingest] Complete. Processed ${totalProcessedMessages} messages. Discovered ${totalExtractedUrls} total job URLs.`
  );
}

ingestGmailAlerts().catch((error) => {
  console.error('[Gmail Ingest] Fatal execution error:', error);
  process.exit(1);
});
