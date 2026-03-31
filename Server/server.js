require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('./auth');
const db = require('./database');

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
        name TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS attendances (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id),
        student_id TEXT REFERENCES users(id),
        login_at TIMESTAMPTZ NOT NULL,
        UNIQUE (class_id, student_id)
      );
    `);
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
  <h1>🚀 Sistema SaaS de Presença</h1>
  <a href="/login">Login com Discord</a>
  `);
});

console.log('DATABASE_URL', process.env.DATABASE_URL);
console.log('NODE_ENV', process.env.NODE_ENV);
// LOGIN
app.get('/login', passport.authenticate('discord'));


// CALLBACK
app.get('/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => res.redirect('/dashboard')
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

    const professorClasses = req.user.role === 'professor' ? await db.query(
      `SELECT id, name, active, started_at FROM classes WHERE professor_id = $1 ORDER BY started_at DESC`,
      [req.user.id]
    ) : null;

    const classesDisponiveis = req.user.role === 'aluno' ? await db.query(
      `SELECT c.id, c.name, u.username as professor_name FROM classes c JOIN users u ON u.id = c.professor_id WHERE c.active = true ORDER BY c.started_at DESC`)
      : null;

    const classesHtml = req.user.role === 'professor'
      ? professorClasses.rows.map(c => `<li><a href="/class/${c.id}">${c.name}</a> - ${c.active ? 'Ativa' : 'Encerrada'} - ${new Date(c.started_at).toLocaleString()}</li>`).join('')
      : (classesDisponiveis?.rows || []).map(c => `<li>${c.name} (Prof. ${c.professor_name}) <a href="/class/${c.id}">Entrar</a></li>`).join('');

    const classForm = req.user.role === 'professor'
      ? `<form method="POST" action="/class/start"> <input name="name" required placeholder="Nome da sala" /> <button>Iniciar chamada</button> </form>`
      : '';

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
:root {
  --bg: #0f172a;
  --card: #1e293b;
  --text: white;
}

.light {
  --bg: #f1f5f9;
  --card: white;
  --text: black;
}

body {
  margin: 0;
  font-family: 'Inter', sans-serif;
  background: var(--bg);
  color: var(--text);
  display: flex;
  transition: 0.3s;
}

.sidebar {
  width: 250px;
  background: #020617;
  padding: 20px;
}

.content {
  flex: 1;
  padding: 30px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.card {
  background: var(--card);
  padding: 20px;
  border-radius: 16px;
  margin-bottom: 20px;
  transition: 0.3s;
}

.card:hover {
  transform: translateY(-5px);
}

.grid {
  display: flex;
  gap: 20px;
}

.metric {
  flex: 1;
  text-align: center;
}

.metric h2 {
  font-size: 30px;
}

button {
  padding: 10px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
}
</style>
</head>

<body>

<div class="sidebar">
  <h2>📊 Dashboard</h2>
  <p>${req.user.username} (${req.user.role || 'sem role'})</p>
  <p><a href="/dashboard" style="color: #fff;">Visão Geral</a></p>
  <p><a href="/classes" style="color: #fff;">Salas de Aula</a></p>
  <p><a href="/logout" style="color: #fff;">Sair</a></p>
</div>

<div class="content">

  <div class="topbar">
    <h1>Visão Geral</h1>
    <button onclick="toggleTheme()">🌙 / ☀️</button>
  </div>

  <div class="grid">

    <div class="card metric">
      <h2>${totalGeral.total}</h2>
      <p>Total de Presenças</p>
    </div>

    <div class="card metric">
      <h2>${valores[valores.length - 1] || 0}</h2>
      <p>Hoje</p>
    </div>

  </div>

  <div class="card">
    <h2>🏫 Gerenciamento de Sala</h2>
    ${classForm}
    <ul>${classesHtml}</ul>
  </div>

  <div class="card">
    <h2>📈 Presenças por dia</h2>
    <canvas id="chart"></canvas>
  </div>

  <div class="card">
    <h2>🚀 Sistema ativo</h2>
    <p>Seu SaaS está funcionando perfeitamente.</p>
    <img width="200" src="https://cdn-icons-png.flaticon.com/512/906/906175.png"/>
  </div>

</div>

<script>
function toggleTheme() {
  document.body.classList.toggle('light');
}

const ctx = document.getElementById('chart');

new Chart(ctx, {
  type: 'line',
  data: {
    labels: ${JSON.stringify(labels)},
    datasets: [{
      label: 'Presenças',
      data: ${JSON.stringify(valores)},
      tension: 0.4,
      fill: true
    }]
  }
});
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
      `INSERT INTO classes (professor_id, name, active, started_at) VALUES ($1, $2, true, NOW()) RETURNING id`,
      [req.user.id, name]
    );
    const classId = result.rows[0].id;
    res.redirect(`/class/${classId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao iniciar classe');
  }
});

app.post('/class/:id/join', ensureAuthenticated, ensureAluno, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = req.params.id;
  try {
    await db.query(`INSERT INTO attendances (class_id, student_id, login_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
      [classId, req.user.id]);
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

    const attendances = await db.query(
      `SELECT a.*, u.username FROM attendances a JOIN users u ON a.student_id = u.id WHERE a.class_id = $1 ORDER BY login_at ASC`,
      [classId]
    );

    const members = attendances.rows;

    // timeline do professor
    const timeline = await db.query(
      `SELECT c.id, c.name, c.active, c.started_at, c.ended_at, COUNT(a.id) AS total_presencas
       FROM classes c
       LEFT JOIN attendances a ON a.class_id = c.id
       WHERE c.professor_id = $1
       GROUP BY c.id
       ORDER BY c.started_at DESC`,
       [classData.professor_id]
    );

    res.send(`
      <h1>Sala de Aula: ${classData.name}</h1>
      <p>Professor: ${classData.professor_name}</p>
      <p>Status: ${classData.active ? 'Ativa' : 'Encerrada'}</p>
      <h2>Presenças (Atualização a cada 5s)</h2>
      <ul id="attendance-list">
        ${members.map(m => `<li>${m.username} (${new Date(m.login_at).toLocaleString()})</li>`).join('')}
      </ul>
      ${req.user.role === 'aluno' && classData.active ? `<form method="POST" action="/class/${classId}/join"><button>Registrar presença</button></form>` : ''}
      <h2>Timeline do professor</h2>
      <ul>
        ${timeline.rows.map(t => `<li>${t.name} - ${t.total_presencas} alunos - ${t.active ? 'Ativa' : 'Encerrada'}</li>`).join('')}
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
    const attendances = await db.query(
      `SELECT u.username, a.login_at FROM attendances a JOIN users u ON a.student_id = u.id WHERE a.class_id = $1 ORDER BY a.login_at ASC`,
      [classId]
    );
    res.json(attendances.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao buscar participantes' });
  }
});

app.get('/classes', ensureAuthenticated, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  try {
    let html = '<h1>Salas de Aula</h1>';

    if (req.user.role === 'professor') {
      const classes = await db.query(`SELECT id, name, active, started_at FROM classes WHERE professor_id = $1 ORDER BY started_at DESC`, [req.user.id]);
      html += `<h2>Suas salas</h2><ul>${classes.rows.map(c => `<li>${c.name} - ${c.active ? 'Ativa' : 'Encerrada'} - <a href="/class/${c.id}">Abrir</a> ${c.active ? `<form method="POST" action="/class/${c.id}/end" style="display:inline"><button>Encerrar</button></form>` :' '}</li>`).join('')}</ul>`;
      html += `<h3>Criar nova sala</h3><form method="POST" action="/class/start"><input name="name" required placeholder="Nome da sala"/><button>Iniciar chamada</button></form>`;
    } else {
      const classes = await db.query(`SELECT c.id, c.name, c.active, u.username AS professor_name FROM classes c JOIN users u ON u.id = c.professor_id WHERE c.active = true ORDER BY c.started_at DESC`);
      html += `<h2>Salas disponíveis</h2><ul>${classes.rows.map(c => `<li>${c.name} (Prof. ${c.professor_name}) - <a href="/class/${c.id}">Abrir</a></li>`).join('')}</ul>`;
    }

    html += '<p><a href="/dashboard">Voltar ao dashboard</a></p>';
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar lista de salas');
  }
});

app.post('/class/:id/end', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = req.params.id;
  try {
    await db.query(`UPDATE classes SET active = false, ended_at = NOW() WHERE id = $1 AND professor_id = $2`, [classId, req.user.id]);
    res.redirect('/classes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao encerrar classe');
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