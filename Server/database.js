const { Pool } = require('pg');

let pool;
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
} catch (error) {
  console.error('Erro ao conectar ao DB:', error.message);
  pool = null;
}

module.exports = pool;