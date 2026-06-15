const { Client } = require('pg');
require('dotenv').config({ path: 'c:\\Users\\Administrador\\Downloads\\Bot-pro\\Bot-pro\\Server\\.env' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('--- DATABASE CHECK ---');
    
    const users = await client.query('SELECT COUNT(*) FROM users');
    console.log('Total Users:', users.rows[0].count);
    
    const mappings = await client.query('SELECT COUNT(*) FROM discord_mappings');
    console.log('Total Discord Mappings:', mappings.rows[0].count);
    
    const attendances = await client.query('SELECT COUNT(*) FROM attendances');
    console.log('Total Attendances:', attendances.rows[0].count);
    
    const sessions = await client.query('SELECT COUNT(*) FROM class_sessions');
    console.log('Total Class Sessions:', sessions.rows[0].count);
    
    const enrollments = await client.query('SELECT COUNT(*) FROM enrollments');
    console.log('Total Enrollments:', enrollments.rows[0].count);
    
    // Ver presenças por sessão
    const sessRows = await client.query(`
      SELECT cs.id, cs.class_id, c.name AS class_name, cs.start_time, COUNT(a.id) AS att_count
      FROM class_sessions cs
      JOIN classes c ON c.id = cs.class_id
      LEFT JOIN attendances a ON a.class_session_id = cs.id
      GROUP BY cs.id, cs.class_id, c.name, cs.start_time
      ORDER BY cs.start_time DESC
    `);
    console.log('\nSessions and Attendances Count:');
    console.table(sessRows.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

check();
