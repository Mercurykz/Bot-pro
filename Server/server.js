require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('./auth');
const db = require('./database');

const XLSX = require('xlsx');
const app = express();

app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));

// Cria tabelas básicas se não existirem
(async function initDb() {
  if (!db) {
    console.error('DB não conectado. Configure DATABASE_URL.');
    return;
  }
  try {
    // Testa conexão
    await db.query('SELECT 1');
    console.log('DB conectado com sucesso.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'aluno'
      );

      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        professor_id TEXT REFERENCES users(id),
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS class_sessions (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id),
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS attendances (
        id SERIAL PRIMARY KEY,
        class_session_id INTEGER REFERENCES class_sessions(id),
        student_id TEXT REFERENCES users(id),
        student_name TEXT,
        login_at TIMESTAMPTZ NOT NULL,
        UNIQUE (class_session_id, student_id)
      );
    `);

    // Garante colunas do novo modelo de sessão
    await db.query(`ALTER TABLE attendances ADD COLUMN IF NOT EXISTS class_session_id INTEGER REFERENCES class_sessions(id)`);
    await db.query(`ALTER TABLE attendances ADD COLUMN IF NOT EXISTS student_name TEXT`);
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS attendances_class_session_student_idx ON attendances (class_session_id, student_id)`);
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS attendances_class_session_name_idx ON attendances (class_session_id, student_name)`);
    console.log('DB initialized');
  } catch (err) {
    console.error('Erro ao inicializar DB:', err);
  }
})();

app.use(session({
  secret: process.env.SESSION_SECRET || 'segredo',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());


// HOME
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presença Plus | Sistema de Presença Discord</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Poppins', sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1a1f3a 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f1f5f9;
    }

    .container {
      text-align: center;
      max-width: 500px;
      padding: 40px 20px;
    }

    .logo {
      font-size: 60px;
      margin-bottom: 20px;
      display: inline-block;
    }

    h1 {
      font-size: 40px;
      font-weight: 700;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    p {
      font-size: 16px;
      color: #94a3b8;
      margin-bottom: 30px;
      line-height: 1.6;
    }

    .features {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin-bottom: 40px;
      text-align: left;
    }

    .feature {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .feature-icon {
      font-size: 24px;
    }

    .feature-text {
      font-size: 14px;
      color: #cbd5e1;
    }

    .btn {
      display: inline-block;
      padding: 16px 40px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 600;
      font-size: 16px;
      transition: all 0.3s ease;
      border: 2px solid transparent;
      cursor: pointer;
    }

    .btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 30px rgba(99, 102, 241, 0.3);
    }

    .btn:active {
      transform: translateY(-1px);
    }

    .footer {
      margin-top: 40px;
      font-size: 12px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">✨</div>
    <h1>Presença Plus</h1>
    <p>Sistema inteligente de presença integrado com Discord</p>
    
    <div class="features">
      <div class="feature">
        <div class="feature-icon">📊</div>
        <div class="feature-text">Controle de presença em tempo real</div>
      </div>
      <div class="feature">
        <div class="feature-icon">🏫</div>
        <div class="feature-text">Gerenciamento de múltiplas salas</div>
      </div>
      <div class="feature">
        <div class="feature-icon">📋</div>
        <div class="feature-text">Relatórios e exportação em CSV/XLSX</div>
      </div>
      <div class="feature">
        <div class="feature-icon">👥</div>
        <div class="feature-text">Integração com Discord</div>
      </div>
    </div>

    <a href="/login" class="btn">Entrar com Discord</a>

    <div class="footer">
      <p>© 2026 Presença Plus. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>
  `);
});

console.log('DATABASE_URL', process.env.DATABASE_URL);
console.log('NODE_ENV', process.env.NODE_ENV);
console.log('CALLBACK_URL', process.env.CALLBACK_URL);
console.log('CLIENT_ID defined:', !!process.env.CLIENT_ID);
console.log('CLIENT_SECRET defined:', !!process.env.CLIENT_SECRET);

// LOGIN
app.get('/login', passport.authenticate('discord'));


// CALLBACK
app.get('/callback',
  passport.authenticate('discord', { failureRedirect: '/', failureMessage: true }),
  (req, res) => {
    console.log('✅ OAuth callback sucesso:', req.user?.id);
    res.redirect('/dashboard');
  }
);

// Fallback para /auth/discord/callback (common convention)
app.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/', failureMessage: true }),
  (req, res) => {
    console.log('✅ OAuth callback sucesso (alt route):', req.user?.id);
    res.redirect('/dashboard');
  }
);


// DASHBOARD
app.get('/dashboard', async (req, res) => {
  if (!req.user) return res.redirect('/');
  if (!db) return res.send('Erro: DB não conectado.');

  try {

    // 📊 gráfico
    const result = await db.query(`
  SELECT 
    DATE(login_at) as dia,
    COUNT(*) as total
  FROM attendances
  GROUP BY DATE(login_at)
  ORDER BY dia ASC
`);

    const rows = result.rows;
    const labels = rows.map(r => r.dia);
    const valores = rows.map(r => r.total);

    // 📈 total geral
    const totalResult = await db.query(`
      SELECT COUNT(*) as total FROM attendances
    `);

    const totalGeral = totalResult.rows[0] || { total: 0 };

    let professorClasses = null;
    let activeRooms = new Set();

    if (req.user.role === 'professor') {
      professorClasses = await db.query(`SELECT id, name FROM classes WHERE professor_id = $1 ORDER BY id DESC`, [req.user.id]);
      const activeSessions = await db.query(`SELECT class_id FROM class_sessions WHERE active = true AND class_id IN (SELECT id FROM classes WHERE professor_id = $1)`, [req.user.id]);
      activeRooms = new Set(activeSessions.rows.map(r => r.class_id));
    }

    const classesDisponiveis = req.user.role === 'aluno' ? await db.query(
      `SELECT c.id, c.name, u.username as professor_name, MAX(s.start_time) as last_start_time
       FROM class_sessions s
       JOIN classes c ON c.id = s.class_id
       JOIN users u ON u.id = c.professor_id
       WHERE s.active = true
       GROUP BY c.id, c.name, u.username
       ORDER BY last_start_time DESC`)
      : null;

    const classesHtml = req.user.role === 'professor'
      ? professorClasses.rows.map(c => `<li><a href="/class/${c.id}">${c.name}</a> - ${activeRooms.has(c.id) ? 'Em chamada' : 'Disponível'}</li>`).join('')
      : (classesDisponiveis?.rows || []).map(c => `<li>${c.name} (Prof. ${c.professor_name}) <a href="/class/${c.id}">Entrar</a></li>`).join('');

    const classForm = req.user.role === 'professor'
      ? `<form method="POST" action="/class/start"> <input name="name" required placeholder="Nome da sala" /> <button>Iniciar chamada</button> </form>`
      : '';

    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Presença Plus | Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #6366f1;
  --secondary: #8b5cf6;
  --danger: #ef4444;
  --success: #10b981;
  --warning: #f59e0b;
  --bg-dark: #0f172a;
  --bg-darker: #020617;
  --card-dark: #1e293b;
  --text-light: #f1f5f9;
  --text-muted: #94a3b8;
  --border-color: #334155;
}

.light {
  --primary: #6366f1;
  --secondary: #8b5cf6;
  --danger: #ef4444;
  --success: #10b981;
  --warning: #f59e0b;
  --bg-dark: #f8fafc;
  --bg-darker: #f1f5f9;
  --card-dark: #ffffff;
  --text-light: #1e293b;
  --text-muted: #64748b;
  --border-color: #e2e8f0;
}

html, body {
  font-family: 'Poppins', sans-serif;
  background: var(--bg-dark);
  color: var(--text-light);
  height: 100%;
}

body {
  display: flex;
}

.sidebar {
  width: 280px;
  background: var(--bg-darker);
  border-right: 1px solid var(--border-color);
  padding: 30px 20px;
  overflow-y: auto;
  position: fixed;
  height: 100vh;
}

.sidebar h2 {
  font-size: 24px;
  margin-bottom: 10px;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.user-info {
  background: var(--card-dark);
  padding: 15px;
  border-radius: 12px;
  margin-bottom: 20px;
  border-left: 4px solid var(--primary);
}

.user-info p:first-child {
  font-weight: 600;
  margin-bottom: 5px;
}

.user-info p:last-child {
  font-size: 12px;
  color: var(--text-muted);
  display: inline-block;
  background: var(--primary);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  margin-top: 5px;
}

.nav-menu {
  list-style: none;
  margin-bottom: 20px;
}

.nav-menu li {
  margin-bottom: 10px;
}

.nav-menu a {
  display: block;
  padding: 12px 16px;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.3s ease;
  border-left: 3px solid transparent;
}

.nav-menu a:hover {
  background: var(--card-dark);
  color: var(--text-light);
  border-left-color: var(--primary);
}

.nav-menu a.logout {
  color: var(--danger);
}

.content {
  margin-left: 280px;
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  max-height: 100vh;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.topbar h1 {
  font-size: 32px;
  font-weight: 700;
}

.theme-btn {
  background: var(--card-dark);
  border: 1px solid var(--border-color);
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.3s;
}

.theme-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.card {
  background: var(--card-dark);
  border: 1px solid var(--border-color);
  padding: 24px;
  border-radius: 14px;
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-4px);
  border-color: var(--primary);
  box-shadow: 0 10px 30px rgba(99, 102, 241, 0.1);
}

.metric {
  text-align: center;
}

.metric h2 {
  font-size: 36px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.metric p {
  color: var(--text-muted);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.card h2 {
  font-size: 20px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

ul {
  list-style: none;
}

li {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

li:last-child {
  border-bottom: none;
}

a {
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;
}

a:hover {
  color: var(--secondary);
}

.status-badge {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-active {
  background: rgba(16, 185, 129, 0.2);
  color: var(--success);
}

.status-inactive {
  background: rgba(100, 116, 139, 0.2);
  color: var(--text-muted);
}

form {
  background: var(--card-dark);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  margin-bottom: 20px;
}

form input,
form label {
  display: block;
  width: 100%;
  margin-bottom: 12px;
}

form input {
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-darker);
  color: var(--text-light);
  border-radius: 8px;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  transition: border-color 0.3s;
}

form input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

form label {
  font-weight: 500;
  margin-bottom: 6px;
}

button {
  padding: 12px 24px;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  transition: all 0.3s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(99, 102, 241, 0.3);
}

button:active {
  transform: translateY(0);
}

.chart-container {
  background: var(--card-dark);
  padding: 24px;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  margin-bottom: 20px;
}

canvas {
  max-height: 300px;
}

@media (max-width: 1024px) {
  .sidebar {
    width: 200px;
  }
  .content {
    margin-left: 200px;
    padding: 20px;
  }
}

@media (max-width: 768px) {
  body {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    height: auto;
    position: static;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
  .content {
    margin-left: 0;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-darker);
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--primary);
}
</style>
</head>

<body>

<div class="sidebar">
  <h2>✨ Presença Plus</h2>
  
  <div class="user-info">
    <p>${req.user.username}</p>
    <p>${req.user.role === 'professor' ? '👨‍🏫 Professor' : '👨‍🎓 Aluno'}</p>
  </div>

  <ul class="nav-menu">
    <li><a href="/dashboard">📊 Dashboard</a></li>
    <li><a href="/classes">🏫 Salas de Aula</a></li>
    ${req.user.role === 'professor' ? '<li><a href="/chamadas">📋 Chamadas</a></li>' : ''}
    <li><a href="/logout" class="logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">

  <div class="topbar">
    <div>
      <h1>Bem-vindo, ${req.user.username}!</h1>
      <p style="color: var(--text-muted); margin-top: 5px;">Gerencie suas salas e presenças facilmente</p>
    </div>
    <button class="theme-btn" onclick="toggleTheme()">🌙</button>
  </div>

  <div class="grid">

    <div class="card metric">
      <h2>${totalGeral.total}</h2>
      <p>Total de Presenças</p>
    </div>

    <div class="card metric">
      <h2>${valores[valores.length - 1] || 0}</h2>
      <p>Presenças Hoje</p>
    </div>

  </div>

  <div class="card">
    <h2>🏫 Gerenciamento de Sala</h2>
    ${classForm}
    <ul>${classesHtml || '<li style="color: var(--text-muted);">Nenhuma sala disponível</li>'}</ul>
  </div>

  <div class="chart-container">
    <h2>📈 Presenças por dia</h2>
    <canvas id="chart"></canvas>
  </div>

</div>

<script>
function toggleTheme() {
  document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
}

if (localStorage.getItem('theme') === 'light') {
  document.documentElement.classList.add('light');
}

const ctx = document.getElementById('chart');
if (ctx) {
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ${JSON.stringify(labels)},
      datasets: [{
        label: 'Presenças',
        data: ${JSON.stringify(valores)},
        tension: 0.4,
        fill: true,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          ticks: {
            color: 'var(--text-muted)'
          },
          grid: {
            color: 'var(--border-color)'
          }
        },
        x: {
          ticks: {
            color: 'var(--text-muted)'
          },
          grid: {
            color: 'var(--border-color)'
          }
        }
      }
    }
  });
}
</script>

</body>
</html>
    `);

  } catch (err) {
    console.error('Erro no dashboard:', err.message);
    console.error(err.stack);
    res.send('Erro no dashboard: ' + err.message);
  }
});


// GUILD (AGORA COM POSTGRES)
app.get('/guild/:id', async (req, res) => {
  if (!req.user) return res.redirect('/');
  if (!db) return res.send('Erro: DB não conectado.');

  const guildId = req.params.id;

  try {
    const result = await db.query(
      `SELECT * FROM presencas WHERE guild_id = $1`,
      [guildId]
    );

    const rows = result.rows;

    const lista = rows.map(r => `
      <tr>
        <td>${r.username}</td>
        <td>${new Date(r.data).toLocaleString()}</td>
      </tr>
    `).join('');

    res.send(`
      <h1>📊 Presenças</h1>
      <table border="1">
        <tr><th>Usuário</th><th>Data</th></tr>
        ${lista}
      </table>
      <p>Total: ${rows.length}</p>
    `);

  } catch (err) {
    console.error(err);
    res.send('Erro ao carregar guild');
  }
});

// helpers
function ensureAuthenticated(req, res, next) {
  if (!req.user) return res.redirect('/');
  return next();
}

function ensureProfessor(req, res, next) {
  if (!req.user || req.user.role !== 'professor') {
    return res.status(403).send('Acesso negado: apenas professores.');
  }
  return next();
}

function ensureAluno(req, res, next) {
  if (!req.user || req.user.role !== 'aluno') {
    return res.status(403).send('Acesso negado: apenas alunos.');
  }
  return next();
}

// endpoints de gestão de sala
app.get('/profile', ensureAuthenticated, async (req, res) => {
  res.redirect('/dashboard');
});

app.post('/class/start', ensureAuthenticated, ensureProfessor, express.urlencoded({ extended: true }), async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const { name } = req.body;
  if (!name) return res.status(400).send('Nome da sala (classe) obrigatório');

  try {
    const result = await db.query(
      `INSERT INTO classes (professor_id, name) VALUES ($1, $2) RETURNING id`,
      [req.user.id, name]
    );
    const classId = result.rows[0].id;
    res.redirect(`/class/${classId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao criar sala');
  }
});

app.post('/class/:id/start-session', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = req.params.id;
  try {
    const classData = await db.query(`SELECT * FROM classes WHERE id = $1 AND professor_id = $2`, [classId, req.user.id]);
    if (!classData.rowCount) return res.status(404).send('Sala não encontrada');

    await db.query(`UPDATE class_sessions SET active = false, end_time = NOW() WHERE class_id = $1 AND active = true`, [classId]);
    await db.query(`INSERT INTO class_sessions (class_id, start_time, active) VALUES ($1, NOW(), true)`, [classId]);
    res.redirect(`/class/${classId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao iniciar sessão de chamada');
  }
});

app.post('/class/:id/join', ensureAuthenticated, ensureAluno, express.urlencoded({ extended: true }), async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = req.params.id;
  const fullName = req.body.fullName?.trim();

  if (!fullName) {
    return res.status(400).send('Informe seu nome completo para registrar presença.');
  }

  try {
    const sessionRes = await db.query(`SELECT id FROM class_sessions WHERE class_id = $1 AND active = true LIMIT 1`, [classId]);
    if (!sessionRes.rowCount) return res.status(400).send('Não há chamada ativa para esta sala.');

    const sessionId = sessionRes.rows[0].id;

    const existing = await db.query(`SELECT student_name FROM attendances WHERE class_session_id = $1 AND student_id = $2`, [sessionId, req.user.id]);
    if (existing.rowCount) {
      const currentName = existing.rows[0].student_name || '';
      if (currentName.trim() !== fullName) {
        return res.status(400).send(`Presença já registrada com o nome '${currentName}'. Não é possível trocar para '${fullName}' nesta chamada.`);
      }
      return res.redirect(`/class/${classId}`);
    }

    await db.query(`INSERT INTO attendances (class_session_id, student_id, student_name, login_at) VALUES ($1, $2, $3, NOW())`,
      [sessionId, req.user.id, fullName]);

    res.redirect(`/class/${classId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao registrar presença');
  }
});

app.get('/class/:id', ensureAuthenticated, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = req.params.id;
  try {
    const classRes = await db.query(`SELECT c.*, u.username AS professor_name FROM classes c JOIN users u ON c.professor_id = u.id WHERE c.id = $1`, [classId]);
    if (!classRes.rowCount) return res.status(404).send('Classe não encontrada');

    const classData = classRes.rows[0];

    const sessionRes = await db.query(`SELECT * FROM class_sessions WHERE class_id = $1 ORDER BY start_time DESC LIMIT 1`, [classId]);
    const activeSession = sessionRes.rowCount ? sessionRes.rows[0] : null;

    let members = [];
    if (activeSession) {
      const attendances = await db.query(
        `SELECT a.*, u.username FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_session_id = $1 ORDER BY login_at ASC`,
        [activeSession.id]
      );
      members = attendances.rows;
    }

    // timeline de sessões do professor
    const timeline = await db.query(
      `SELECT s.id, s.start_time, s.end_time, s.active, COUNT(a.id) AS total_presencas
       FROM class_sessions s
       LEFT JOIN attendances a ON a.class_session_id = s.id
       WHERE s.class_id = $1
       GROUP BY s.id, s.start_time, s.end_time, s.active
       ORDER BY s.start_time DESC`,
       [classId]
    );

    res.send(`
      <h1>Sala de Aula: ${classData.name}</h1>
      <p>Professor: ${classData.professor_name}</p>
      <p>Status: ${activeSession && activeSession.active ? 'Em chamada' : 'Inativa'}</p>
      <h2>Presenças (Atualização a cada 5s)</h2>
      <ul id="attendance-list">
        ${members.map(m => `<li>${m.student_name || m.username} (${new Date(m.login_at).toLocaleString()})</li>`).join('')}
      </ul>

      ${req.user.role === 'aluno' && activeSession && activeSession.active ? `<form method="POST" action="/class/${classId}/join">
        <label>Nome completo: <input name="fullName" required placeholder="Nome completo" /></label>
        <button>Registrar presença</button>
      </form>` : ''}

      ${req.user.role === 'professor' && activeSession && activeSession.active ? `<form method="POST" action="/class/${classId}/mark">
        <label>Marcar presença por nome: <input name="fullName" required placeholder="Nome completo do aluno" /></label>
        <button>Marcar presença</button>
      </form>
      <form method="POST" action="/class/${classId}/end" style="margin-top: 10px;">
        <button>Encerrar chamada</button>
      </form>` : ''}

      ${req.user.role === 'professor' && (!activeSession || !activeSession.active) ? `<form method="POST" action="/class/${classId}/start-session" style="margin-top: 10px;"><button>Iniciar chamada</button></form>` : ''}

      <h2>Timeline do professor</h2>
      <ul>
        ${timeline.rows.map(t => `<li>${new Date(t.start_time).toLocaleString()} - ${t.total_presencas} alunos - ${t.active ? 'Ativa' : 'Encerrada'}</li>`).join('')}
      </ul>
      <p><a href="/dashboard">Voltar ao dashboard</a></p>
      <script>
        async function refreshAttendance() {
          const res = await fetch('/class/${classId}/attendees');
          const data = await res.json();
          const list = document.getElementById('attendance-list');
          list.innerHTML = data.map(item => '<li>' + item.username + ' (' + new Date(item.login_at).toLocaleString() + ')</li>').join('');
        }
        setInterval(refreshAttendance, 5000);
      </script>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar classe');
  }
});

app.get('/class/:id/attendees', ensureAuthenticated, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  const classId = req.params.id;
  try {
    const sessionRes = await db.query(`SELECT id FROM class_sessions WHERE class_id = $1 AND active = true LIMIT 1`, [classId]);
    if (!sessionRes.rowCount) return res.json([]);

    const sessionId = sessionRes.rows[0].id;
    const attendances = await db.query(
      `SELECT u.username, a.student_name, a.login_at FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_session_id = $1 ORDER BY a.login_at ASC`,
      [sessionId]
    );
    res.json(attendances.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao buscar participantes' });
  }
});

app.get('/chamadas', ensureAuthenticated, ensureProfessor, (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presença Plus | Chamadas</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary: #6366f1;
      --secondary: #8b5cf6;
      --bg-dark: #0f172a;
      --card-dark: #1e293b;
      --text-light: #f1f5f9;
      --text-muted: #94a3b8;
      --border-color: #334155;
      --success: #10b981;
    }

    .light {
      --bg-dark: #f8fafc;
      --card-dark: #ffffff;
      --text-light: #1e293b;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
    }

    html, body {
      font-family: 'Poppins', sans-serif;
      background: var(--bg-dark);
      color: var(--text-light);
      min-height: 100vh;
    }

    body {
      display: flex;
    }

    .sidebar {
      width: 280px;
      background: linear-gradient(180deg, #020617 0%, #0f172a 100%);
      border-right: 1px solid var(--border-color);
      padding: 30px 20px;
      height: 100vh;
      position: fixed;
      overflow-y: auto;
    }

    .sidebar h2 {
      font-size: 24px;
      margin-bottom: 20px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .nav-menu {
      list-style: none;
    }

    .nav-menu li {
      margin-bottom: 10px;
    }

    .nav-menu a {
      display: block;
      padding: 12px 16px;
      color: var(--text-muted);
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.3s;
      border-left: 3px solid transparent;
    }

    .nav-menu a:hover {
      background: var(--card-dark);
      color: var(--text-light);
      border-left-color: var(--primary);
    }

    .content {
      margin-left: 280px;
      flex: 1;
      padding: 40px;
      overflow-y: auto;
      max-height: 100vh;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
    }

    .topbar h1 {
      font-size: 32px;
      font-weight: 700;
    }

    .card {
      background: var(--card-dark);
      border: 1px solid var(--border-color);
      padding: 24px;
      border-radius: 14px;
      margin-bottom: 20px;
    }

    .form-group {
      display: flex;
      gap: 12px;
      align-items: flex-end;
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 14px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    input[type="date"] {
      padding: 12px 16px;
      background: var(--bg-dark);
      border: 1px solid var(--border-color);
      color: var(--text-light);
      border-radius: 8px;
      font-family: 'Poppins', sans-serif;
      font-size: 14px;
      flex: 1;
      max-width: 250px;
    }

    input[type="date"]:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    button {
      padding: 12px 24px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-family: 'Poppins', sans-serif;
      transition: all 0.3s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 14px;
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(99, 102, 241, 0.3);
    }

    ul {
      list-style: none;
    }

    li {
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-dark);
      border-radius: 8px;
      margin-bottom: 8px;
      gap: 12px;
    }

    li:last-child {
      border-bottom: none;
    }

    a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s;
    }

    a:hover {
      color: var(--secondary);
    }

    .result-empty {
      text-align: center;
      padding: 40px;
      color: var(--text-muted);
    }

    .result-empty p {
      margin: 0;
      font-size: 16px;
    }

    .back-link {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 20px;
      background: var(--card-dark);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      text-decoration: none;
      color: var(--primary);
      transition: all 0.3s;
    }

    .back-link:hover {
      background: var(--border-color);
    }

    @media (max-width: 768px) {
      body {
        flex-direction: column;
      }
      .sidebar {
        width: 100%;
        height: auto;
        position: static;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
      }
      .content {
        margin-left: 0;
        padding: 20px;
      }
      .form-group {
        flex-direction: column;
        align-items: stretch;
      }
      input[type="date"] {
        max-width: 100%;
      }
    }
  </style>
</head>
<body>

<div class="sidebar">
  <h2>✨ Presença Plus</h2>
  <ul class="nav-menu">
    <li><a href="/dashboard">📊 Dashboard</a></li>
    <li><a href="/classes">🏫 Salas de Aula</a></li>
    <li><a href="/chamadas">📋 Chamadas</a></li>
    <li><a href="/logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">
  <div class="topbar">
    <h1>📋 Histórico de Chamadas</h1>
  </div>

  <div class="card">
    <div class="form-group">
      <div style="flex: 1;">
        <label for="date">Selecione a data</label>
        <input id="date" type="date" />
      </div>
      <button id="load">Carregar</button>
    </div>
    <div id="result"></div>
  </div>

  <a href="/dashboard" class="back-link">← Voltar ao Dashboard</a>
</div>

<script>
  document.getElementById('load').addEventListener('click', async () => {
    const date = document.getElementById('date').value;
    if (!date) return alert('Selecione uma data');
    
    const resp = await fetch('/chamadas/api/' + date);
    if (!resp.ok) return alert('Falha ao carregar chamadas');
    
    const data = await resp.json();
    const target = document.getElementById('result');
    
    if (!data.length) {
      target.innerHTML = '<div class="result-empty"><p>📭 Nenhuma chamada registrada nessa data.</p></div>';
      return;
    }
    
    target.innerHTML = '<h3 style="margin-bottom: 16px;">📚 Salas Encontradas</h3><ul>' + data.map(c => {
      const time = new Date(c.start_time).toLocaleTimeString('pt-BR');
      return \`<li>
        <div>
          <strong>\${c.name}</strong>
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">⏰ \${time}</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <a href="/class/\${c.class_id}">Abrir</a>
          <a href="/chamadas/\${c.session_id}/export?date=\${date}&format=xlsx">📥 Exportar</a>
        </div>
      </li>\`;
    }).join('') + '</ul>';
  });
</script>

</body>
</html>
  `);
});

app.get('/chamadas/api/:date', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  const date = req.params.date; // YYYY-MM-DD
  try {
    const sessions = await db.query(
      `SELECT s.id AS session_id, c.id AS class_id, c.name, s.active, s.start_time, s.end_time
       FROM class_sessions s
       JOIN classes c ON c.id = s.class_id
       WHERE c.professor_id = $1 AND DATE(s.start_time) = $2
       ORDER BY s.start_time DESC`,
      [req.user.id, date]
    );
    res.json(sessions.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao listar chamadas' });
  }
});

app.get('/chamadas/:sessionId/export', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).send('Erro: DB não conectado.');
  const sessionId = req.params.sessionId;
  const date = req.query.date;
  try {
    const sessionResult = await db.query(`SELECT s.id, s.class_id, c.name FROM class_sessions s JOIN classes c ON c.id = s.class_id WHERE s.id = $1`, [sessionId]);
    if (!sessionResult.rowCount) return res.status(404).send('Sessão não encontrada');

    const sessionData = sessionResult.rows[0];

    const attendances = await db.query(
      `SELECT COALESCE(a.student_name,u.username) as student_name, u.username as discord_username, a.login_at FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_session_id = $1 ORDER BY a.login_at ASC`,
      [sessionId]
    );

    const rows = attendances.rows;

    if (req.query.format === 'xlsx') {
      const sheetData = rows.map(r => ({
        Nome: r.student_name,
        Discord: r.discord_username,
        'Data/Hora': new Date(r.login_at).toLocaleString()
      }));
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Chamadas');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="chamada-${sessionData.name.replace(/\s/g,'_')}-${date}.xlsx"`);
      res.send(buffer);
    } else {
      const csv = ['Nome;Discord;Data/Hora', ...rows.map(r => `${r.student_name};${r.discord_username};${new Date(r.login_at).toLocaleString()}`)].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
      res.setHeader('Content-Disposition', `attachment; filename="chamada-${classData.name.replace(/\s/g,'_')}-${date}.csv"`);
      res.send(csv);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao exportar chamada');
  }
});

app.get('/classes', ensureAuthenticated, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  try {
    if (req.user.role === 'professor') {
      const rooms = await db.query(`SELECT id, name FROM classes WHERE professor_id = $1 ORDER BY id DESC`, [req.user.id]);
      const activeSessions = await db.query(`SELECT class_id FROM class_sessions WHERE active = true AND class_id IN (SELECT id FROM classes WHERE professor_id = $1)`, [req.user.id]);
      const activeSet = new Set(activeSessions.rows.map(r => r.class_id));

      const roomsList = rooms.rows.map(r => {
        const isActive = activeSet.has(r.id);
        const statusBadge = isActive ? '<span class="badge badge-active">🔴 Em Chamada</span>' : '<span class="badge badge-inactive">⚪ Disponível</span>';
        return `<li>
          <div>
            <strong>${r.name}</strong>
            <div style="margin-top: 8px;">${statusBadge}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="/class/${r.id}">Abrir</a>
            ${isActive ? `<form method="POST" action="/class/${r.id}/end" style="display:inline; margin: 0;"><button type="submit" class="btn-danger">Encerrar</button></form>` : `<form method="POST" action="/class/${r.id}/start-session" style="display:inline; margin: 0;"><button type="submit">Iniciar</button></form>`}
          </div>
        </li>`;
      }).join('');

      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presença Plus | Salas de Aula</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary: #6366f1;
      --secondary: #8b5cf6;
      --danger: #ef4444;
      --bg-dark: #0f172a;
      --card-dark: #1e293b;
      --text-light: #f1f5f9;
      --text-muted: #94a3b8;
      --border-color: #334155;
      --success: #10b981;
    }

    .light {
      --bg-dark: #f8fafc;
      --card-dark: #ffffff;
      --text-light: #1e293b;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
    }

    html, body {
      font-family: 'Poppins', sans-serif;
      background: var(--bg-dark);
      color: var(--text-light);
      min-height: 100vh;
    }

    body {
      display: flex;
    }

    .sidebar {
      width: 280px;
      background: linear-gradient(180deg, #020617 0%, #0f172a 100%);
      border-right: 1px solid var(--border-color);
      padding: 30px 20px;
      height: 100vh;
      position: fixed;
      overflow-y: auto;
    }

    .sidebar h2 {
      font-size: 24px;
      margin-bottom: 20px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .nav-menu {
      list-style: none;
    }

    .nav-menu li {
      margin-bottom: 10px;
    }

    .nav-menu a {
      display: block;
      padding: 12px 16px;
      color: var(--text-muted);
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.3s;
      border-left: 3px solid transparent;
    }

    .nav-menu a:hover {
      background: var(--card-dark);
      color: var(--text-light);
      border-left-color: var(--primary);
    }

    .content {
      margin-left: 280px;
      flex: 1;
      padding: 40px;
      overflow-y: auto;
      max-height: 100vh;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
    }

    .topbar h1 {
      font-size: 32px;
      font-weight: 700;
    }

    .card {
      background: var(--card-dark);
      border: 1px solid var(--border-color);
      padding: 24px;
      border-radius: 14px;
      margin-bottom: 20px;
    }

    .card h2 {
      font-size: 20px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    form {
      display: flex;
      gap: 12px;
      margin-bottom: 0;
    }

    form input {
      flex: 1;
      padding: 12px 16px;
      background: var(--bg-dark);
      border: 1px solid var(--border-color);
      color: var(--text-light);
      border-radius: 8px;
      font-family: 'Poppins', sans-serif;
    }

    form input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    button, .btn-danger {
      padding: 12px 20px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-family: 'Poppins', sans-serif;
      transition: all 0.3s;
      font-size: 14px;
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(99, 102, 241, 0.3);
    }

    .btn-danger {
      background: linear-gradient(135deg, var(--danger), #dc2626);
    }

    .btn-danger:hover {
      box-shadow: 0 5px 20px rgba(239, 68, 68, 0.3);
    }

    ul {
      list-style: none;
    }

    li {
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-dark);
      border-radius: 8px;
      margin-bottom: 8px;
      gap: 12px;
    }

    li:last-child {
      border-bottom: none;
    }

    a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s;
    }

    a:hover {
      color: var(--secondary);
    }

    .badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .badge-active {
      background: rgba(239, 68, 68, 0.2);
      color: var(--danger);
    }

    .badge-inactive {
      background: rgba(148, 163, 184, 0.2);
      color: var(--text-muted);
    }

    .back-link {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 20px;
      background: var(--card-dark);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      text-decoration: none;
      color: var(--primary);
      transition: all 0.3s;
    }

    .back-link:hover {
      background: var(--border-color);
    }

    @media (max-width: 768px) {
      body {
        flex-direction: column;
      }
      .sidebar {
        width: 100%;
        height: auto;
        position: static;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
      }
      .content {
        margin-left: 0;
        padding: 20px;
      }
      form {
        flex-direction: column;
      }
      li {
        flex-direction: column;
        align-items: flex-start;
      }
      li > div:last-child {
        width: 100%;
        display: flex;
        gap: 8px;
      }
    }
  </style>
</head>
<body>

<div class="sidebar">
  <h2>✨ Presença Plus</h2>
  <ul class="nav-menu">
    <li><a href="/dashboard">📊 Dashboard</a></li>
    <li><a href="/classes">🏫 Salas de Aula</a></li>
    <li><a href="/chamadas">📋 Chamadas</a></li>
    <li><a href="/logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">
  <div class="topbar">
    <h1>🏫 Salas de Aula</h1>
  </div>

  <div class="card">
    <h2>➕ Criar Nova Sala</h2>
    <form method="POST" action="/class/start">
      <input name="name" required placeholder="Nome da sala" />
      <button type="submit">Criar Sala</button>
    </form>
  </div>

  <div class="card">
    <h2>📚 Minhas Salas</h2>
    <ul>${roomsList}</ul>
  </div>

  <a href="/dashboard" class="back-link">← Voltar ao Dashboard</a>
</div>

</body>
</html>
      `;
      res.send(html);
    } else {
      const classes = await db.query(`SELECT c.id, c.name, u.username AS professor_name FROM class_sessions s JOIN classes c ON s.class_id = c.id JOIN users u ON c.professor_id = u.id WHERE s.active = true ORDER BY s.start_time DESC`);
      
      const classList = classes.rows.map(c => `<li>
        <div>
          <strong>${c.name}</strong>
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">👨‍🏫 Prof. ${c.professor_name}</div>
        </div>
        <a href="/class/${c.id}">Entrar</a>
      </li>`).join('');

      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presença Plus | Salas Disponíveis</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary: #6366f1;
      --secondary: #8b5cf6;
      --bg-dark: #0f172a;
      --card-dark: #1e293b;
      --text-light: #f1f5f9;
      --text-muted: #94a3b8;
      --border-color: #334155;
    }

    .light {
      --bg-dark: #f8fafc;
      --card-dark: #ffffff;
      --text-light: #1e293b;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
    }

    html, body {
      font-family: 'Poppins', sans-serif;
      background: var(--bg-dark);
      color: var(--text-light);
      min-height: 100vh;
    }

    body {
      display: flex;
    }

    .sidebar {
      width: 280px;
      background: linear-gradient(180deg, #020617 0%, #0f172a 100%);
      border-right: 1px solid var(--border-color);
      padding: 30px 20px;
      height: 100vh;
      position: fixed;
      overflow-y: auto;
    }

    .sidebar h2 {
      font-size: 24px;
      margin-bottom: 20px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .nav-menu {
      list-style: none;
    }

    .nav-menu li {
      margin-bottom: 10px;
    }

    .nav-menu a {
      display: block;
      padding: 12px 16px;
      color: var(--text-muted);
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.3s;
      border-left: 3px solid transparent;
    }

    .nav-menu a:hover {
      background: var(--card-dark);
      color: var(--text-light);
      border-left-color: var(--primary);
    }

    .content {
      margin-left: 280px;
      flex: 1;
      padding: 40px;
      overflow-y: auto;
      max-height: 100vh;
    }

    .topbar {
      margin-bottom: 40px;
    }

    .topbar h1 {
      font-size: 32px;
      font-weight: 700;
    }

    .card {
      background: var(--card-dark);
      border: 1px solid var(--border-color);
      padding: 24px;
      border-radius: 14px;
      margin-bottom: 20px;
    }

    .card h2 {
      font-size: 20px;
      margin-bottom: 20px;
    }

    ul {
      list-style: none;
    }

    li {
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-dark);
      border-radius: 8px;
      margin-bottom: 8px;
      gap: 12px;
    }

    li:last-child {
      border-bottom: none;
    }

    a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s;
    }

    a:hover {
      color: var(--secondary);
    }

    .back-link {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 20px;
      background: var(--card-dark);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      text-decoration: none;
      color: var(--primary);
      transition: all 0.3s;
    }

    .back-link:hover {
      background: var(--border-color);
    }

    @media (max-width: 768px) {
      body {
        flex-direction: column;
      }
      .sidebar {
        width: 100%;
        height: auto;
        position: static;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
      }
      .content {
        margin-left: 0;
        padding: 20px;
      }
    }
  </style>
</head>
<body>

<div class="sidebar">
  <h2>✨ Presença Plus</h2>
  <ul class="nav-menu">
    <li><a href="/dashboard">📊 Dashboard</a></li>
    <li><a href="/classes">🏫 Salas de Aula</a></li>
    <li><a href="/logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">
  <div class="topbar">
    <h1>🎓 Salas Disponíveis</h1>
    <p style="color: var(--text-muted); margin-top: 8px;">Escolha uma sala para registrar sua presença</p>
  </div>

  <div class="card">
    <h2>📚 Salas Ativas</h2>
    <ul>${classList || '<li style="color: var(--text-muted);">📭 Nenhuma sala disponível no momento</li>'}</ul>
  </div>

  <a href="/dashboard" class="back-link">← Voltar ao Dashboard</a>
</div>

</body>
</html>
      `;
      res.send(html);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar lista de salas');
  }
});

app.post('/class/:id/end', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = req.params.id;
  try {
    await db.query(`UPDATE class_sessions SET active = false, end_time = NOW() WHERE class_id = $1 AND active = true`, [classId]);
    res.redirect('/classes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao encerrar classe');
  }
});

app.post('/class/:id/mark', ensureAuthenticated, ensureProfessor, express.urlencoded({ extended: true }), async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = req.params.id;
  const fullName = req.body.fullName?.trim();

  if (!fullName) return res.status(400).send('Informe o nome completo do aluno para marcar presença.');

  try {
    const sessionRes = await db.query(`SELECT id FROM class_sessions WHERE class_id = $1 AND active = true LIMIT 1`, [classId]);
    if (!sessionRes.rowCount) return res.status(400).send('Não há chamada ativa para esta sala.');

    const sessionId = sessionRes.rows[0].id;

    const existing = await db.query(`SELECT id FROM attendances WHERE class_session_id = $1 AND student_name = $2 LIMIT 1`, [sessionId, fullName]);
    if (existing.rowCount) {
      await db.query(`UPDATE attendances SET login_at = NOW() WHERE id = $1`, [existing.rows[0].id]);
    } else {
      await db.query(`INSERT INTO attendances (class_session_id, student_name, login_at) VALUES ($1, $2, NOW())`, [sessionId, fullName]);
    }

    res.redirect(`/class/${classId}`);
  } catch (err) {
    console.error('Erro ao marcar presença por nome:', err);
    res.status(500).send('Erro ao registrar presença por nome');
  }
});

app.get('/logout', ensureAuthenticated, (req, res) => {
  req.logout(err => {
    if (err) console.error(err);
    res.redirect('/');
  });
});

// START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🌐 Server rodando na porta ' + PORT);
});