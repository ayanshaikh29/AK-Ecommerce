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
    
    console.log('Running migration...');
    const sql = `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS assigned_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;`;
    await client.query(sql);
    console.log('Migration ran successfully!');
    
    // Check columns on users table
    const checkSql = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'assigned_vendor_id';
    `;
    const res = await client.query(checkSql);
    if (res.rows.length > 0) {
      console.log('Verification Success: assigned_vendor_id exists on users table!');
    } else {
      console.error('Verification Failure: column was not found after migration.');
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
