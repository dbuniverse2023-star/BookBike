const { Pool } = require('pg');

const useSSL = String(process.env.DATABASE_SSL).toLowerCase() === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Prevent an idle client error from crashing the whole process
  console.error('[db] Unexpected error on idle client', err);
});

module.exports = pool;
