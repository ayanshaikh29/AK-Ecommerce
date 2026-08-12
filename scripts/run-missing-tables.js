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
  console.error('Usage: node scripts/run-missing-tables.js <password>');
  process.exit(1);
}

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
    
    console.log('Running migration for missing tables...');
    const sqlPath = path.join(__dirname, '..', 'schema-missing-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('Migration completed successfully!');
    
    // Verify tables exist
    const checkSql = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('return_requests', 'bulk_enquiries', 'activity_logs', 'chat_logs', 'product_qa', 'catalog_access_requests', 'product_requests')
      ORDER BY table_name;
    `;
    const res = await client.query(checkSql);
    console.log('Verified tables created:', res.rows.map(r => r.table_name).join(', '));
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
