const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env
try {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  });
} catch (e) {}

const dbPassword = process.argv[2] || process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.error('Error: Please provide the database password as an argument or set SUPABASE_DB_PASSWORD in your .env file.');
  console.error('Usage: node scripts/run-migration.js <password>');
  process.exit(1);
}

// Supabase host typically resolves to aws-0-[region].pooler.supabase.com or similar.
// We can also try the project ref pooler address directly.
const host = 'aws-0-ap-south-1.pooler.supabase.com'; // Adjust if region is different, or try connection string
const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.xgxqremmwxnwplhpvtux.supabase.co:5432/postgres`;

console.log('Connecting to database...');
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected successfully!');
    
    console.log('Running migration from schema-profile-fields.sql...');
    const sqlPath = path.join(__dirname, '..', 'schema-profile-fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('Migration ran successfully!');
    
    // Check columns on users table
    const checkSql = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `;
    const res = await client.query(checkSql);
    const cols = res.rows.map(r => r.column_name);
    console.log('Verification: columns currently on users table:', cols);
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
