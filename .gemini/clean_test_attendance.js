const { Client } = require('pg');
require('dotenv').config({ path: 'c:\\Users\\Administrador\\Downloads\\Bot-pro\\Bot-pro\\Bot\\.env' });

async function clean() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Connected to DB');
    
    // 1. Limpa da tabela presencas (Discord log) para o usuário mercurykz. ou mercury
    const res1 = await client.query(
      "DELETE FROM presencas WHERE LOWER(username) IN ('mercurykz.', 'mercury');"
    );
    console.log(`Deleted ${res1.rowCount} rows from 'presencas' table.`);
    
    // 2. Limpa da tabela attendances (presenças oficiais da aula) para o Ygor
    const res2 = await client.query(
      "DELETE FROM attendances WHERE LOWER(student_name) LIKE '%ygor belarmino%';"
    );
    console.log(`Deleted ${res2.rowCount} rows from 'attendances' table.`);
    
    console.log('Successfully cleaned all test attendances!');
  } catch (err) {
    console.error('Error cleaning DB:', err.message);
  } finally {
    await client.end();
  }
}

clean();
