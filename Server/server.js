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

    let professorClasses = null;
    let activeRooms = new Set();

    if (req.user.role === 'professor') {
      professorClasses = await db.query(`SELECT id, name FROM classes WHERE professor_id = $1 ORDER BY id DESC`, [req.user.id]);
      const activeSessions = await db.query(`SELECT class_id FROM class_sessions WHERE active = true AND class_id IN (SELECT id FROM classes WHERE professor_id = $1)`, [req.user.id]);
      activeRooms = new Set(activeSessions.rows.map(r => r.class_id));
    }

    const classesDisponiveis = req.user.role === 'aluno' ? await db.query(
      `SELECT DISTINCT c.id, c.name, u.username as professor_name FROM class_sessions s JOIN classes c ON c.id = s.class_id JOIN users u ON u.id = c.professor_id WHERE s.active = true ORDER BY s.start_time DESC`)
      : null;

    const classesHtml = req.user.role === 'professor'
      ? professorClasses.rows.map(c => `<li><a href="/class/${c.id}">${c.name}</a> - ${activeRooms.has(c.id) ? 'Em chamada' : 'Disponível'}</li>`).join('')
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
  ${req.user.role === 'professor' ? '<p><a href="/chamadas" style="color: #fff;">Chamadas</a></p>' : ''}
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
    await db.query(`INSERT INTO attendances (class_session_id, student_id, student_name, login_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (class_session_id, student_id) DO UPDATE SET student_name = EXCLUDED.student_name`,
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
    <h1>Chamadas</h1>
    <p>Selecione a data para ver as salas:</p>
    <input id="date" type="date" />
    <button id="load">Carregar</button>
    <div id="result"></div>
    <script>
      document.getElementById('load').addEventListener('click', async () => {
        const date = document.getElementById('date').value;
        if (!date) return alert('Selecione uma data');
        const resp = await fetch('/chamadas/api/' + date);
        if (!resp.ok) return alert('Falha ao carregar chamadas');
        const data = await resp.json();
        const target = document.getElementById('result');
        if (!data.length) return target.innerHTML = '<p>Nenhuma chamada nessa data.</p>';
        target.innerHTML = '<h2>Salas</h2><ul>' + data.map(c =>
          '<li>' + c.name + ' (' + new Date(c.start_time).toLocaleTimeString() + ') - <a href="/class/' + c.class_id + '">Abrir</a> - <a href="/chamadas/' + c.session_id + '/export?date=' + date + '&format=xlsx">Exportar XLSX</a></li>'
        ).join('') + '</ul>';
      });
    </script>
    <p><a href="/dashboard">Voltar</a></p>
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
    let html = '<h1>Salas de Aula</h1>';

    if (req.user.role === 'professor') {
      const rooms = await db.query(`SELECT id, name FROM classes WHERE professor_id = $1 ORDER BY id DESC`, [req.user.id]);
      const activeSessions = await db.query(`SELECT class_id FROM class_sessions WHERE active = true AND class_id IN (SELECT id FROM classes WHERE professor_id = $1)`, [req.user.id]);
      const activeSet = new Set(activeSessions.rows.map(r => r.class_id));

      html += `<h2>Salas</h2><ul>` + rooms.rows.map(r => {
        const isActive = activeSet.has(r.id);
        return `<li>${r.name} - ${isActive ? 'Em chamada' : 'Disponível'} - <a href="/class/${r.id}">Abrir</a>` +
          (isActive ? ` <form method="POST" action="/class/${r.id}/end" style="display:inline"><button>Encerrar chamada</button></form>` : ` <form method="POST" action="/class/${r.id}/start-session" style="display:inline"><button>Iniciar chamada</button></form>`) +
          `</li>`;
      }).join('') + `</ul>`;
      html += `<h3>Criar nova sala</h3><form method="POST" action="/class/start"><input name="name" required placeholder="Nome da sala"/><button>Criar sala</button></form>`;
    } else {
      const classes = await db.query(`SELECT c.id, c.name, u.username AS professor_name FROM class_sessions s JOIN classes c ON s.class_id = c.id JOIN users u ON c.professor_id = u.id WHERE s.active = true ORDER BY s.start_time DESC`);
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