import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve('database/jobs.sqlite');
const db = new Database(dbPath);

// Read and execute the schema to ensure the tables actually exist
const schemaPath = path.resolve('database/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

export default db;
