require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('./auth');
const db = require('./database');

const XLSX = require('xlsx');
const app = express();

let attendanceSchemaCache = null;

async function getAttendanceSchema() {
  if (!db) return { hasClassSessionId: false, hasClassId: false };
  if (attendanceSchemaCache) return attendanceSchemaCache;

  const cols = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attendances'
  `);

  const set = new Set(cols.rows.map(r => r.column_name));
  attendanceSchemaCache = {
    hasClassSessionId: set.has('class_session_id'),
    hasClassId: set.has('class_id')
  };

  return attendanceSchemaCache;
}

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
    console.log('✅ DB conectado com sucesso.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'aluno'
      );

      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        professor_id TEXT REFERENCES users(id),
        subject_id INTEGER REFERENCES subjects(id),
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
    console.log('📋 Verificando migração de colunas...');
    
    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subjects(id)`);
    console.log('  ✓ classes.subject_id OK');
    
    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT false`);
    console.log('  ✓ classes.active OK');
    
    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    console.log('  ✓ classes.started_at OK');
    
    await db.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ`);
    console.log('  ✓ classes.end_time OK');
    
    // Verificar se a coluna class_session_id existe antes de tentar usá-la
    const classSessionIdExists = await db.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'attendances' AND column_name = 'class_session_id'
    `);
    
    if (!classSessionIdExists.rowCount) {
      console.log('  ⚠ Criando attendances.class_session_id...');
      await db.query(`ALTER TABLE attendances ADD COLUMN class_session_id INTEGER REFERENCES class_sessions(id)`);
      console.log('  ✓ attendances.class_session_id criada');
    } else {
      console.log('  ✓ attendances.class_session_id já existe');
    }
    
    // Verificar se a coluna student_name existe
    const studentNameExists = await db.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'attendances' AND column_name = 'student_name'
    `);
    
    if (!studentNameExists.rowCount) {
      console.log('  ⚠ Criando attendances.student_name...');
      await db.query(`ALTER TABLE attendances ADD COLUMN student_name TEXT`);
      console.log('  ✓ attendances.student_name criada');
    } else {
      console.log('  ✓ attendances.student_name já existe');
    }
    
    // Criar índices
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS attendances_class_session_student_idx ON attendances (class_session_id, student_id)`);
    console.log('  ✓ attendances_class_session_student_idx OK');
    
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS attendances_class_session_name_idx ON attendances (class_session_id, student_name)`);
    console.log('  ✓ attendances_class_session_name_idx OK');
    
    attendanceSchemaCache = null;
    const schema = await getAttendanceSchema();
    console.log(`✅ DB initialized com sucesso! attendances.class_session_id=${schema.hasClassSessionId} attendances.class_id=${schema.hasClassId}`);
  } catch (err) {
    console.error('❌ Erro ao inicializar DB:', err.message);
    console.error(err);
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


// Diagnóstico do banco (apenas admin)
app.get('/admin/db-check', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (!db) return res.json({ error: 'DB não conectado' });
  
  try {
    // Verificar colunas da tabela attendances
    const attendancesSchema = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'attendances' 
      ORDER BY ordinal_position
    `);
    
    // Verificar índices
    const indexes = await db.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'attendances'
    `);
    
    // Contar registros
    const counts = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM subjects) as subjects,
        (SELECT COUNT(*) FROM classes) as classes,
        (SELECT COUNT(*) FROM class_sessions) as sessions,
        (SELECT COUNT(*) FROM attendances) as attendances
    `);
    
    res.json({
      status: 'ok',
      attendances_columns: attendancesSchema.rows,
      indexes: indexes.rows,
      counts: counts.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      code: err.code,
      details: err.detail
    });
  }
});

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
    if (req.user.role === 'aluno') {
      const subjects = await db.query(`
        WITH student_classes AS (
          SELECT DISTINCT cs.class_id
          FROM attendances a
          JOIN class_sessions cs ON cs.id = a.class_session_id
          WHERE a.student_id = $1
        ),
        subject_sessions AS (
          SELECT c.subject_id, COALESCE(s.name, 'Sem matéria') AS subject_name, cs.id AS session_id
          FROM class_sessions cs
          JOIN classes c ON c.id = cs.class_id
          LEFT JOIN subjects s ON s.id = c.subject_id
          WHERE cs.class_id IN (SELECT class_id FROM student_classes)
        ),
        student_presence AS (
          SELECT c.subject_id, a.class_session_id
          FROM attendances a
          JOIN class_sessions cs ON cs.id = a.class_session_id
          JOIN classes c ON c.id = cs.class_id
          WHERE a.student_id = $1
        )
        SELECT
          ss.subject_id,
          ss.subject_name,
          COUNT(DISTINCT ss.session_id)::int AS total_sessions,
          COUNT(DISTINCT sp.class_session_id)::int AS attended_sessions
        FROM subject_sessions ss
        LEFT JOIN student_presence sp
          ON sp.class_session_id = ss.session_id
         AND sp.subject_id IS NOT DISTINCT FROM ss.subject_id
        GROUP BY ss.subject_id, ss.subject_name
        ORDER BY ss.subject_name ASC
      `, [req.user.id]);

      const subjectRows = subjects.rows.map(r => ({
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        total_sessions: Number(r.total_sessions) || 0,
        attended_sessions: Number(r.attended_sessions) || 0
      }));

      const totalAttendedRes = await db.query(
        `SELECT COUNT(DISTINCT class_session_id)::int AS total FROM attendances WHERE student_id = $1`,
        [req.user.id]
      );
      const totalAttended = Number(totalAttendedRes.rows[0]?.total || 0);
      const totalAvailable = subjectRows.reduce((sum, s) => sum + s.total_sessions, 0);
      const overallFrequency = totalAvailable > 0 ? ((totalAttended / totalAvailable) * 100) : 0;

      const selectedParam = typeof req.query.subject === 'string' ? req.query.subject : '';
      const selectedRow = subjectRows.find(s => {
        const key = s.subject_id === null ? 'none' : String(s.subject_id);
        return key === selectedParam;
      }) || subjectRows[0] || null;

      let historySql = `
        SELECT
          COALESCE(s.name, 'Sem matéria') AS subject_name,
          c.name AS class_name,
          cs.start_time,
          a.login_at
        FROM attendances a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        JOIN classes c ON c.id = cs.class_id
        LEFT JOIN subjects s ON s.id = c.subject_id
        WHERE a.student_id = $1
      `;
      const historyParams = [req.user.id];
      if (selectedRow) {
        if (selectedRow.subject_id === null) {
          historySql += ` AND c.subject_id IS NULL`;
        } else {
          historyParams.push(selectedRow.subject_id);
          historySql += ` AND c.subject_id = $2`;
        }
      }
      historySql += ` ORDER BY cs.start_time DESC LIMIT 50`;
      const history = await db.query(historySql, historyParams);

      const subjectMenu = subjectRows.map(s => {
        const key = s.subject_id === null ? 'none' : String(s.subject_id);
        const pct = s.total_sessions > 0 ? ((s.attended_sessions / s.total_sessions) * 100).toFixed(1) : '0.0';
        const isActive = selectedRow && ((selectedRow.subject_id === null && s.subject_id === null) || selectedRow.subject_id === s.subject_id);
        return `<li>
          <a href="/dashboard?subject=${key}" class="${isActive ? 'active-subject' : ''}">
            <span>📘 ${s.subject_name}</span>
            <strong>${pct}%</strong>
          </a>
        </li>`;
      }).join('');

      const selectedPct = selectedRow && selectedRow.total_sessions > 0
        ? ((selectedRow.attended_sessions / selectedRow.total_sessions) * 100).toFixed(1)
        : '0.0';

      const historyList = history.rows.map(h => `<li>
        <div>
          <strong>${h.class_name}</strong>
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">📘 ${h.subject_name}</div>
        </div>
        <div style="text-align:right; color: var(--text-muted); font-size: 12px;">
          <div>🕒 Aula: ${new Date(h.start_time).toLocaleString('pt-BR')}</div>
          <div>✅ Presença: ${new Date(h.login_at).toLocaleString('pt-BR')}</div>
        </div>
      </li>`).join('');

      return res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Presença Plus | Minha Frequência</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
:root {
  --primary:#6366f1; --secondary:#8b5cf6; --bg-dark:#0f172a; --bg-darker:#020617;
  --card-dark:#1e293b; --text-light:#f1f5f9; --text-muted:#94a3b8; --border-color:#334155; --success:#10b981;
}
.light {
  --bg-dark:#f8fafc; --bg-darker:#f1f5f9; --card-dark:#ffffff; --text-light:#1e293b; --text-muted:#64748b; --border-color:#e2e8f0;
}
html, body { font-family:'Poppins',sans-serif; background:var(--bg-dark); color:var(--text-light); min-height:100%; }
body { display:flex; }
.sidebar { width:280px; background:var(--bg-darker); border-right:1px solid var(--border-color); padding:30px 20px; position:fixed; height:100vh; overflow-y:auto; }
.sidebar h2 { font-size:24px; margin-bottom:14px; background:linear-gradient(135deg,var(--primary),var(--secondary)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.user-info { background:var(--card-dark); padding:15px; border-radius:12px; margin-bottom:20px; border-left:4px solid var(--primary); }
.user-info p:last-child { font-size:12px; color:#fff; background:var(--primary); padding:4px 10px; border-radius:20px; display:inline-block; margin-top:6px; }
.nav-menu, .subject-menu { list-style:none; }
.nav-menu li, .subject-menu li { margin-bottom:10px; }
.nav-menu a, .subject-menu a { display:flex; justify-content:space-between; gap:10px; padding:12px 14px; color:var(--text-muted); text-decoration:none; border-radius:10px; border-left:3px solid transparent; transition:.25s; }
.nav-menu a:hover, .subject-menu a:hover { background:var(--card-dark); color:var(--text-light); border-left-color:var(--primary); }
.active-subject { background:var(--card-dark); color:var(--text-light)!important; border-left-color:var(--success)!important; }
.content { margin-left:280px; flex:1; padding:40px; }
.topbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:16px; margin-bottom:20px; }
.card { background:var(--card-dark); border:1px solid var(--border-color); border-radius:14px; padding:22px; }
.metric h2 { font-size:34px; background:linear-gradient(135deg,var(--primary),var(--secondary)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.metric p { color:var(--text-muted); font-size:13px; text-transform:uppercase; letter-spacing:.7px; }
.layout { display:grid; grid-template-columns: 340px 1fr; gap:16px; }
.history li { padding:12px 0; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; gap:8px; }
.history li:last-child { border-bottom:none; }
.theme-btn { background:var(--card-dark); border:1px solid var(--border-color); color:var(--text-light); padding:10px 14px; border-radius:8px; cursor:pointer; }
@media (max-width: 980px) { .layout { grid-template-columns:1fr; } }
@media (max-width: 768px) {
  body { flex-direction:column; }
  .sidebar { position:static; width:100%; height:auto; }
  .content { margin-left:0; padding:20px; }
}
</style>
</head>
<body>
  <div class="sidebar">
    <h2>✨ Presença Plus</h2>
    <div class="user-info">
      <p>${req.user.username}</p>
      <p>👨‍🎓 Aluno</p>
    </div>
    <ul class="nav-menu">
      <li><a href="/dashboard">📊 Minha Frequência</a></li>
      <li><a href="/classes">🏫 Salas de Aula</a></li>
      <li><a href="/logout">🚪 Sair</a></li>
    </ul>
  </div>

  <div class="content">
    <div class="topbar">
      <div>
        <h1>Minha Frequência por Matéria</h1>
        <p style="color:var(--text-muted); margin-top:4px;">Acompanhe seu desempenho em cada disciplina.</p>
      </div>
      <button class="theme-btn" onclick="toggleTheme()">🌙</button>
    </div>

    <div class="grid">
      <div class="card metric">
        <h2>${totalAttended}</h2>
        <p>Chamadas com Presença</p>
      </div>
      <div class="card metric">
        <h2>${overallFrequency.toFixed(1)}%</h2>
        <p>Frequência Geral</p>
      </div>
      <div class="card metric">
        <h2>${selectedPct}%</h2>
        <p>Frequência na Matéria Selecionada</p>
      </div>
    </div>

    <div class="layout">
      <div class="card" id="materias">
        <h2 style="margin-bottom:14px;">📚 Menu de Matérias</h2>
        <ul class="subject-menu">${subjectMenu || '<li style="color:var(--text-muted);">Sem matérias com presença ainda.</li>'}</ul>
      </div>

      <div>
        <div class="card" style="margin-bottom:16px;">
          <h2 style="margin-bottom:10px;">📈 Frequência por Matéria</h2>
          <canvas id="freqChart" height="130"></canvas>
        </div>
        <div class="card">
          <h2 style="margin-bottom:10px;">🧾 Histórico (${selectedRow ? selectedRow.subject_name : 'Sem matéria'})</h2>
          <ul class="history">${historyList || '<li style="color:var(--text-muted);">Nenhuma presença registrada para esta matéria.</li>'}</ul>
        </div>
      </div>
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

const labels = ${JSON.stringify(subjectRows.map(s => s.subject_name))};
const dataPct = ${JSON.stringify(subjectRows.map(s => s.total_sessions > 0 ? Number(((s.attended_sessions / s.total_sessions) * 100).toFixed(1)) : 0))};

const ctx = document.getElementById('freqChart');
if (ctx) {
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Frequência (%)',
        data: dataPct,
        borderRadius: 8,
        backgroundColor: '#6366f1'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  });
}
</script>
</body>
</html>
      `);
    }

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
    ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/subjects">📚 Matérias</a></li>' : ''}
    ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/chamadas">📋 Chamadas</a></li>' : ''}
    ${req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : ''}
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


app.get('/minhas-materias', ensureAuthenticated, ensureAluno, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');

  try {
    const subjects = await db.query(`
      WITH student_classes AS (
        SELECT DISTINCT cs.class_id
        FROM attendances a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        WHERE a.student_id = $1
      ),
      subject_sessions AS (
        SELECT c.subject_id, COALESCE(s.name, 'Sem matéria') AS subject_name, cs.id AS session_id
        FROM class_sessions cs
        JOIN classes c ON c.id = cs.class_id
        LEFT JOIN subjects s ON s.id = c.subject_id
        WHERE cs.class_id IN (SELECT class_id FROM student_classes)
      ),
      student_presence AS (
        SELECT c.subject_id, a.class_session_id
        FROM attendances a
        JOIN class_sessions cs ON cs.id = a.class_session_id
        JOIN classes c ON c.id = cs.class_id
        WHERE a.student_id = $1
      )
      SELECT
        ss.subject_id,
        ss.subject_name,
        COUNT(DISTINCT ss.session_id)::int AS total_sessions,
        COUNT(DISTINCT sp.class_session_id)::int AS attended_sessions
      FROM subject_sessions ss
      LEFT JOIN student_presence sp
        ON sp.class_session_id = ss.session_id
       AND sp.subject_id IS NOT DISTINCT FROM ss.subject_id
      GROUP BY ss.subject_id, ss.subject_name
      ORDER BY ss.subject_name ASC
    `, [req.user.id]);

    const subjectRows = subjects.rows.map(r => ({
      subject_id: r.subject_id,
      subject_name: r.subject_name,
      total_sessions: Number(r.total_sessions) || 0,
      attended_sessions: Number(r.attended_sessions) || 0
    }));

    const selectedParam = typeof req.query.subject === 'string' ? req.query.subject : '';
    const selectedRow = subjectRows.find(s => {
      const key = s.subject_id === null ? 'none' : String(s.subject_id);
      return key === selectedParam;
    }) || subjectRows[0] || null;

    let historySql = `
      SELECT
        COALESCE(s.name, 'Sem matéria') AS subject_name,
        c.name AS class_name,
        cs.start_time,
        a.login_at
      FROM attendances a
      JOIN class_sessions cs ON cs.id = a.class_session_id
      JOIN classes c ON c.id = cs.class_id
      LEFT JOIN subjects s ON s.id = c.subject_id
      WHERE a.student_id = $1
    `;
    const historyParams = [req.user.id];
    if (selectedRow) {
      if (selectedRow.subject_id === null) {
        historySql += ` AND c.subject_id IS NULL`;
      } else {
        historyParams.push(selectedRow.subject_id);
        historySql += ` AND c.subject_id = $2`;
      }
    }
    historySql += ` ORDER BY cs.start_time DESC LIMIT 50`;
    const history = await db.query(historySql, historyParams);

    const subjectCards = subjectRows.map(s => {
      const key = s.subject_id === null ? 'none' : String(s.subject_id);
      const isActive = selectedRow && ((selectedRow.subject_id === null && s.subject_id === null) || selectedRow.subject_id === s.subject_id);
      return `<a href="/minhas-materias?subject=${key}" class="subject-card ${isActive ? 'active' : ''}">
        <div class="subject-title">📘 ${s.subject_name}</div>
        <div class="subject-count">${s.attended_sessions} presença${s.attended_sessions === 1 ? '' : 's'}</div>
        <div class="subject-sub">${s.total_sessions} aula${s.total_sessions === 1 ? '' : 's'} registrada${s.total_sessions === 1 ? '' : 's'}</div>
      </a>`;
    }).join('');

    const historyList = history.rows.map(h => `<li>
      <div><strong>${h.class_name}</strong><div style="color:#94a3b8;font-size:12px;">📘 ${h.subject_name}</div></div>
      <div style="color:#94a3b8;font-size:12px;text-align:right;">${new Date(h.login_at).toLocaleString('pt-BR')}</div>
    </li>`).join('');

    const totalAttended = subjectRows.reduce((sum, s) => sum + s.attended_sessions, 0);
    const totalSessions = subjectRows.reduce((sum, s) => sum + s.total_sessions, 0);

    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Presença Plus | Minhas Matérias</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --primary: #6366f1;
      --secondary: #8b5cf6;
      --bg-dark: #0f172a;
      --bg-darker: #020617;
      --card-dark: #1e293b;
      --text-light: #f1f5f9;
      --text-muted: #94a3b8;
      --border-color: #334155;
    }

    .light {
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
      min-height: 100vh;
    }

    body { display: flex; }

    .sidebar {
      width: 280px;
      background: var(--bg-darker);
      border-right: 1px solid var(--border-color);
      padding: 30px 20px;
      position: fixed;
      height: 100vh;
      overflow-y: auto;
    }

    .sidebar h2 {
      font-size: 24px;
      margin-bottom: 12px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .user-info {
      background: var(--card-dark);
      padding: 15px;
      border-radius: 12px;
      margin-bottom: 20px;
      border-left: 4px solid var(--primary);
    }

    .user-info p:last-child {
      margin-top: 6px;
      display: inline-block;
      font-size: 12px;
      background: var(--primary);
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
    }

    .nav-menu { list-style: none; }
    .nav-menu li { margin-bottom: 10px; }

    .nav-menu a {
      display: block;
      padding: 12px 16px;
      color: var(--text-muted);
      text-decoration: none;
      border-radius: 8px;
      border-left: 3px solid transparent;
      transition: all .25s;
    }

    .nav-menu a:hover,
    .nav-menu a.active-link {
      background: var(--card-dark);
      color: var(--text-light);
      border-left-color: var(--primary);
    }

    .content {
      margin-left: 280px;
      flex: 1;
      padding: 40px;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .theme-btn {
      background: var(--card-dark);
      border: 1px solid var(--border-color);
      color: var(--text-light);
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .card {
      background: var(--card-dark);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 22px;
    }

    .metric h2 {
      font-size: 34px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .metric p {
      color: var(--text-muted);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: .8px;
    }

    .layout {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 16px;
    }

    ul { list-style: none; }

    .subject-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 12px;
    }

    .subject-card {
      display: block;
      padding: 14px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      background: var(--bg-darker);
      color: var(--text-light);
      text-decoration: none;
      transition: all .25s;
    }

    .subject-card:hover,
    .subject-card.active {
      transform: translateY(-2px);
      border-color: var(--primary);
      box-shadow: 0 8px 18px rgba(99, 102, 241, 0.15);
    }

    .subject-title {
      font-weight: 600;
      margin-bottom: 8px;
    }

    .subject-count {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 4px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subject-sub {
      color: var(--text-muted);
      font-size: 12px;
    }

    .history-list li {
      padding: 12px 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }

    .history-list li:last-child { border-bottom: none; }

    @media (max-width: 980px) {
      .layout { grid-template-columns: 1fr; }
    }

    @media (max-width: 768px) {
      body { flex-direction: column; }
      .sidebar { position: static; width: 100%; height: auto; }
      .content { margin-left: 0; padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <h2>✨ Presença Plus</h2>

    <div class="user-info">
      <p>${req.user.username}</p>
      <p>👨‍🎓 Aluno</p>
    </div>

    <ul class="nav-menu">
      <li><a href="/dashboard">📊 Dashboard</a></li>
      <li><a href="/minhas-materias" class="active-link">📚 Minhas Matérias</a></li>
      <li><a href="/classes">🏫 Salas de Aula</a></li>
      <li><a href="/logout">🚪 Sair</a></li>
    </ul>
  </div>

  <div class="content">
    <div class="topbar">
      <div>
        <h1>Minha Frequência por Matéria</h1>
        <p style="color:var(--text-muted); margin-top:4px;">Acompanhe suas presenças por disciplina.</p>
      </div>
      <button class="theme-btn" onclick="toggleTheme()">🌙</button>
    </div>

    <div class="grid">
      <div class="card metric"><h2>${totalAttended}</h2><p>Presenças registradas</p></div>
      <div class="card metric"><h2>${totalSessions}</h2><p>Aulas registradas</p></div>
      <div class="card metric"><h2>${subjectRows.length}</h2><p>Matérias no histórico</p></div>
    </div>

    <div class="layout">
      <div class="card">
        <h2 style="margin-bottom:12px;">📚 Matérias</h2>
        <div class="subject-grid">${subjectCards || '<div style="color:var(--text-muted);">Sem matérias ainda.</div>'}</div>
      </div>

      <div class="card">
        <h2 style="margin-bottom:12px;">🧾 Presenças ${selectedRow ? `- ${selectedRow.subject_name}` : ''}</h2>
        <ul class="history-list">${historyList || '<li style="color:var(--text-muted);">Nenhuma presença para esta matéria.</li>'}</ul>
      </div>
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
</script>
</body>
</html>
    `);
  } catch (err) {
    console.error('Erro em /minhas-materias:', err);
    res.status(500).send('Erro ao carregar matérias do aluno');
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
      <li>
        <span><strong>${r.username}</strong></span>
        <span style="color: var(--text-muted);">${new Date(r.data).toLocaleString('pt-BR')}</span>
      </li>
    `).join('');

    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Presença Plus | Guild ${guildId}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{--primary:#6366f1;--secondary:#8b5cf6;--bg-dark:#0f172a;--bg-darker:#020617;--card-dark:#1e293b;--text-light:#f1f5f9;--text-muted:#94a3b8;--border-color:#334155}
    .light{--bg-dark:#f8fafc;--bg-darker:#f1f5f9;--card-dark:#fff;--text-light:#1e293b;--text-muted:#64748b;--border-color:#e2e8f0}
    html,body{font-family:Poppins,sans-serif;background:var(--bg-dark);color:var(--text-light);min-height:100vh}
    body{display:flex}
    .sidebar{width:280px;background:var(--bg-darker);border-right:1px solid var(--border-color);padding:30px 20px;position:fixed;height:100vh}
    .sidebar h2{font-size:24px;margin-bottom:20px;background:linear-gradient(135deg,var(--primary),var(--secondary));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .nav-menu{list-style:none}.nav-menu li{margin-bottom:10px}
    .nav-menu a{display:block;padding:12px 16px;color:var(--text-muted);text-decoration:none;border-radius:8px;border-left:3px solid transparent;transition:.25s}
    .nav-menu a:hover{background:var(--card-dark);color:var(--text-light);border-left-color:var(--primary)}
    .content{margin-left:280px;flex:1;padding:40px}
    .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
    .theme-btn{background:var(--card-dark);border:1px solid var(--border-color);color:var(--text-light);padding:10px 14px;border-radius:8px;cursor:pointer}
    .card{background:var(--card-dark);border:1px solid var(--border-color);border-radius:14px;padding:24px}
    ul{list-style:none}
    li{padding:12px 0;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;gap:10px}
    li:last-child{border-bottom:none}
    @media (max-width:768px){body{flex-direction:column}.sidebar{position:static;width:100%;height:auto}.content{margin-left:0;padding:20px}}
  </style>
</head>
<body>
  <div class="sidebar">
    <h2>✨ Presença Plus</h2>
    <ul class="nav-menu">
      <li><a href="/dashboard">📊 Dashboard</a></li>
      <li><a href="/classes">🏫 Salas de Aula</a></li>
      ${req.user.role === 'aluno' ? '<li><a href="/minhas-materias">📚 Minhas Matérias</a></li>' : ''}
      ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/subjects">📚 Matérias</a></li>' : ''}
      ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/chamadas">📋 Chamadas</a></li>' : ''}
      ${req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : ''}
      <li><a href="/logout">🚪 Sair</a></li>
    </ul>
  </div>
  <div class="content">
    <div class="topbar">
      <div>
        <h1>📊 Presenças da Guild ${guildId}</h1>
        <p style="color:var(--text-muted);margin-top:4px;">Total de registros: ${rows.length}</p>
      </div>
      <button class="theme-btn" onclick="toggleTheme()">🌙</button>
    </div>

    <div class="card">
      <ul>${lista || '<li style="color:var(--text-muted);">Nenhum registro encontrado</li>'}</ul>
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
</script>
</body>
</html>
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
  if (!req.user || (req.user.role !== 'professor' && req.user.role !== 'admin')) {
    return res.status(403).send('Acesso negado: apenas professores ou administradores.');
  }
  return next();
}

function ensureAluno(req, res, next) {
  if (!req.user || req.user.role !== 'aluno') {
    return res.status(403).send('Acesso negado: apenas alunos.');
  }
  return next();
}

function ensureAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).send('Acesso negado: apenas administradores.');
  }
  return next();
}

// endpoints de gestão de sala
app.get('/profile', ensureAuthenticated, async (req, res) => {
  res.redirect('/dashboard');
});

app.post('/class/start', ensureAuthenticated, ensureProfessor, express.urlencoded({ extended: true }), async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const { name, subject_id } = req.body;
  if (!name) return res.status(400).send('Nome da sala (classe) obrigatório');

  try {
    // Opcional: verificar se subject_id é válido
    let subjectId = subject_id ? parseInt(subject_id, 10) : null;
    if (subjectId) {
      const subjectRes = await db.query('SELECT id FROM subjects WHERE id = $1', [subjectId]);
      if (!subjectRes.rowCount) subjectId = null;
    }

    const result = await db.query(
      `INSERT INTO classes (professor_id, name, subject_id, active, started_at) VALUES ($1, $2, $3, false, NOW()) RETURNING id`,
      [req.user.id, name, subjectId]
    );
    const classId = result.rows[0].id;
    
    // Cria uma sessão automática para a sala recém-criada
    await db.query(
      `INSERT INTO class_sessions (class_id, start_time, active) VALUES ($1, NOW(), true)`,
      [classId]
    );
    
    console.log(`[DEBUG] Sala criada: ${name} (ID: ${classId}) com sessão automática`);
    res.redirect(`/class/${classId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao criar sala');
  }
});

app.get('/subjects', ensureAuthenticated, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  try {
    const subjectsRes = await db.query('SELECT * FROM subjects ORDER BY name');
    const rows = subjectsRes.rows.map(s => `<li>
      <span>📘 ${s.name}</span>
      ${req.user.role === 'admin' ? `<form method="POST" action="/admin/subject/${s.id}/delete" style="display:inline;margin:0;" onsubmit="return confirm('Tem certeza que deseja excluir esta matéria?');"><button type="submit" class="btn-delete">🗑️ Excluir</button></form>` : ''}
    </li>`).join('');
    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Presença Plus | Matérias</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    :root { --primary:#6366f1; --secondary:#8b5cf6; --bg-dark:#0f172a; --bg-darker:#020617; --card-dark:#1e293b; --text-light:#f1f5f9; --text-muted:#94a3b8; --border-color:#334155; }
    .light { --bg-dark:#f8fafc; --bg-darker:#f1f5f9; --card-dark:#ffffff; --text-light:#1e293b; --text-muted:#64748b; --border-color:#e2e8f0; }
    html, body { font-family:'Poppins',sans-serif; background:var(--bg-dark); color:var(--text-light); min-height:100vh; }
    body { display:flex; }
    .sidebar { width:280px; background:var(--bg-darker); border-right:1px solid var(--border-color); padding:30px 20px; position:fixed; height:100vh; overflow-y:auto; }
    .sidebar h2 { font-size:24px; margin-bottom:20px; background:linear-gradient(135deg,var(--primary),var(--secondary)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .nav-menu { list-style:none; }
    .nav-menu li { margin-bottom:10px; }
    .nav-menu a { display:block; padding:12px 16px; color:var(--text-muted); text-decoration:none; border-radius:8px; border-left:3px solid transparent; transition:all .25s; }
    .nav-menu a:hover { background:var(--card-dark); color:var(--text-light); border-left-color:var(--primary); }
    .content { margin-left:280px; flex:1; padding:40px; }
    .topbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
    .theme-btn { background:var(--card-dark); border:1px solid var(--border-color); color:var(--text-light); padding:10px 14px; border-radius:8px; cursor:pointer; }
    .card { background:var(--card-dark); border:1px solid var(--border-color); border-radius:14px; padding:24px; margin-bottom:18px; }
    ul { list-style:none; }
    li { padding:12px 0; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; }
    li:last-child { border-bottom:none; }
    form { display:flex; gap:10px; margin-top:12px; }
    input { flex:1; padding:12px 14px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-darker); color:var(--text-light); }
    button { padding:12px 16px; border:none; border-radius:8px; background:linear-gradient(135deg,var(--primary),var(--secondary)); color:#fff; font-weight:600; cursor:pointer; }
    .btn-delete { background: linear-gradient(135deg, #ef4444, #dc2626); }
    @media (max-width:768px) { body{flex-direction:column;} .sidebar{position:static;width:100%;height:auto;} .content{margin-left:0;padding:20px;} form{flex-direction:column;} }
  </style>
</head>
<body>
  <div class="sidebar">
    <h2>✨ Presença Plus</h2>
    <ul class="nav-menu">
      <li><a href="/dashboard">📊 Dashboard</a></li>
      <li><a href="/classes">🏫 Salas de Aula</a></li>
      ${req.user.role === 'aluno' ? '<li><a href="/minhas-materias">📚 Minhas Matérias</a></li>' : ''}
      ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/subjects">📚 Matérias</a></li>' : ''}
      ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/chamadas">📋 Chamadas</a></li>' : ''}
      ${req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : ''}
      <li><a href="/logout">🚪 Sair</a></li>
    </ul>
  </div>
  <div class="content">
    <div class="topbar">
      <div>
        <h1>📚 Matérias</h1>
        <p style="color:var(--text-muted);margin-top:4px;">Gerencie as matérias da plataforma.</p>
      </div>
      <button class="theme-btn" onclick="toggleTheme()">🌙</button>
    </div>

    <div class="card">
      <h2 style="margin-bottom:12px;">Lista de matérias</h2>
      <ul>${rows || '<li style="color:var(--text-muted);">Nenhuma matéria cadastrada</li>'}</ul>
    </div>

    ${(req.user.role === 'professor' || req.user.role === 'admin') ? `
    <div class="card">
      <h2 style="margin-bottom:12px;">➕ Nova matéria</h2>
      <form method="POST" action="/subject/create">
        <input name="name" placeholder="Nome da matéria" required />
        <button type="submit">Criar Matéria</button>
      </form>
    </div>
    ` : ''}
  </div>

<script>
function toggleTheme() {
  document.documentElement.classList.toggle('light');
  localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
}
if (localStorage.getItem('theme') === 'light') {
  document.documentElement.classList.add('light');
}
</script>
</body>
</html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar matérias');
  }
});

app.post('/subject/create', ensureAuthenticated, ensureProfessor, express.urlencoded({ extended: true }), async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const { name } = req.body;
  if (!name) return res.status(400).send('Nome da matéria obrigatório');
  try {
    await db.query('INSERT INTO subjects (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name.trim()]);
    res.redirect('/subjects');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao criar matéria');
  }
});

app.post('/class/:id/start-session', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = req.params.id;
  try {
    const classData = req.user.role === 'admin'
      ? await db.query(`SELECT * FROM classes WHERE id = $1`, [classId])
      : await db.query(`SELECT * FROM classes WHERE id = $1 AND professor_id = $2`, [classId, req.user.id]);
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
  if (!db) return res.json({ success: false, error: 'DB não conectado' });
  const classId = req.params.id;
  const fullName = req.body.fullName?.trim();

  if (!fullName) {
    return res.status(400).json({ success: false, error: 'Informe seu nome completo para registrar presença.' });
  }

  try {
    const schema = await getAttendanceSchema();
    const sessionRes = await db.query(`SELECT id FROM class_sessions WHERE class_id = $1 AND active = true LIMIT 1`, [classId]);
    if (!sessionRes.rowCount) return res.status(400).json({ success: false, error: 'Não há chamada ativa para esta sala.' });

    const sessionId = sessionRes.rows[0].id;

    let existing;
    if (schema.hasClassSessionId) {
      existing = await db.query(
        `SELECT student_name FROM attendances WHERE class_session_id = $1 AND student_id = $2`,
        [sessionId, req.user.id]
      );
    } else if (schema.hasClassId) {
      existing = await db.query(
        `SELECT student_name FROM attendances WHERE class_id = $1 AND student_id = $2`,
        [classId, req.user.id]
      );
    } else {
      return res.status(500).json({ success: false, error: 'Tabela attendances sem colunas de vínculo de sessão/sala.' });
    }

    if (existing.rowCount) {
      const currentName = existing.rows[0].student_name || '';
      if (currentName.trim() !== fullName) {
        return res.status(400).json({ 
          success: false, 
          error: 'already_registered',
          message: `Você não pode registrar presença pois já registrou com o nome '${currentName}'` 
        });
      }
      return res.json({ success: true, message: 'Presença já registrada' });
    }

    if (schema.hasClassSessionId && schema.hasClassId) {
      await db.query(
        `INSERT INTO attendances (class_session_id, class_id, student_id, student_name, login_at) VALUES ($1, $2, $3, $4, NOW())`,
        [sessionId, classId, req.user.id, fullName]
      );
    } else if (schema.hasClassSessionId) {
      await db.query(
        `INSERT INTO attendances (class_session_id, student_id, student_name, login_at) VALUES ($1, $2, $3, NOW())`,
        [sessionId, req.user.id, fullName]
      );
    } else {
      await db.query(
        `INSERT INTO attendances (class_id, student_id, student_name, login_at) VALUES ($1, $2, $3, NOW())`,
        [classId, req.user.id, fullName]
      );
    }

    res.json({ success: true, message: 'Presença registrada com sucesso' });
  } catch (err) {
    console.error(err);
    // Erro de chave duplicada (outro aluno com o mesmo nome)
    if (err.code === '23505' && err.constraint === 'attendances_class_session_name_idx') {
      return res.status(400).json({
        success: false,
        error: 'duplicate_name',
        message: 'Este nome já foi registrado nesta chamada. Você não pode se registrar com um nome já utilizado.'
      });
    }
    res.status(500).json({ success: false, error: 'Erro ao registrar presença' });
  }
});

app.get('/class/:id', ensureAuthenticated, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = req.params.id;
  try {
    const schema = await getAttendanceSchema();
    const classRes = await db.query(`
      SELECT c.*, u.username AS professor_name, s.name AS subject_name
      FROM classes c
      JOIN users u ON c.professor_id = u.id
      LEFT JOIN subjects s ON c.subject_id = s.id
      WHERE c.id = $1
    `, [classId]);
    if (!classRes.rowCount) return res.status(404).send('Classe não encontrada');

    const classData = classRes.rows[0];

    const sessionRes = await db.query(`SELECT * FROM class_sessions WHERE class_id = $1 ORDER BY start_time DESC LIMIT 1`, [classId]);
    const activeSession = sessionRes.rowCount ? sessionRes.rows[0] : null;

    let members = [];
    if (activeSession) {
      const membersQuery = schema.hasClassSessionId
        ? {
            sql: `SELECT a.id, a.class_session_id, a.student_id, a.student_name, a.login_at, u.username FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_session_id = $1 ORDER BY a.login_at ASC`,
            params: [activeSession.id]
          }
        : {
            sql: `SELECT a.id, NULL::INTEGER AS class_session_id, a.student_id, a.student_name, a.login_at, u.username FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_id = $1 ORDER BY a.login_at ASC`,
            params: [classId]
          };

      const attendances = await db.query(membersQuery.sql, membersQuery.params);
      members = attendances.rows;
    }

    // timeline de sessões do professor
    const timelineJoin = schema.hasClassSessionId ? 'a.class_session_id = s.id' : 'a.class_id = s.class_id';
    const timeline = await db.query(
      `SELECT s.id, s.start_time, s.end_time, s.active, COUNT(a.id) AS total_presencas
       FROM class_sessions s
       LEFT JOIN attendances a ON ${timelineJoin}
       WHERE s.class_id = $1
       GROUP BY s.id, s.start_time, s.end_time, s.active
       ORDER BY s.start_time DESC`,
       [classId]
    );

    const statusBadge = activeSession && activeSession.active 
      ? '<span class="status-badge active">🔴 Em Chamada</span>' 
      : '<span class="status-badge inactive">⚫ Inativa</span>';

    const attendanceList = members.map(m => `<li>
      <div>
        <strong>${m.student_name || m.username}</strong>
        <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">⏰ ${new Date(m.login_at).toLocaleString('pt-BR')}</div>
      </div>
    </li>`).join('');

    const timelineList = timeline.rows.map(t => `<li>
      <div>
        <strong>${new Date(t.start_time).toLocaleString('pt-BR')}</strong>
        <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">👥 ${t.total_presencas} alunos</div>
      </div>
      <span class="status-badge ${t.active ? 'active' : 'inactive'}">${t.active ? '🟢 Ativa' : '⚫ Encerrada'}</span>
    </li>`).join('');

    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presença Plus | Sala - ${classData.name}</title>
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

    .header {
      margin-bottom: 40px;
    }

    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 12px;
    }

    .header-meta {
      display: flex;
      gap: 20px;
      color: var(--text-muted);
      font-size: 14px;
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

    .status-badge {
      display: inline-block;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-badge.active {
      background: rgba(239, 68, 68, 0.2);
      color: var(--danger);
    }

    .status-badge.inactive {
      background: rgba(100, 116, 139, 0.2);
      color: var(--text-muted);
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

    form {
      background: var(--bg-dark);
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      display: flex;
      gap: 12px;
      align-items: flex-end;
    }

    form label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      font-weight: 500;
      font-size: 14px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    form input {
      padding: 12px 16px;
      background: var(--card-dark);
      border: 1px solid var(--border-color);
      color: var(--text-light);
      border-radius: 8px;
      font-family: 'Poppins', sans-serif;
      font-size: 14px;
    }

    form input:focus {
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
      font-size: 14px;
      transition: all 0.3s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
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

    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--text-muted);
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
      .header h1 {
        font-size: 24px;
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
    ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/subjects">📚 Matérias</a></li>' : ''}
    ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/chamadas">📋 Chamadas</a></li>' : ''}
    ${req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : ''}
    <li><a href="/logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">
  <div class="header">
    <h1>${classData.name}</h1>
    <div class="header-meta">
      <span>👨‍🏫 Prof. ${classData.professor_name}</span>
      <span>📘 ${classData.subject_name || 'Sem matéria'}</span>
      <span>${statusBadge}</span>
    </div>
  </div>

  ${(req.user.role === 'professor' || req.user.role === 'admin') && (!activeSession || !activeSession.active) ? `<div class="card">
    <form method="POST" action="/class/${classId}/start-session">
      <button type="submit">▶️ Iniciar Chamada</button>
    </form>
  </div>` : ''}

  <div class="card">
    <h2>👥 Presenças Atuais</h2>
    ${members.length > 0 ? `<ul id="attendance-list">${attendanceList}</ul>` : '<div class="empty-state"><p>Nenhuma presença registrada ainda</p></div>'}
  </div>

  ${req.user.role === 'aluno' && activeSession && activeSession.active ? `<div class="card">
    <h2>✍️ Registrar Presença</h2>
    <form id="attendance-form">
      <label>
        Nome Completo
        <input id="fullName-input" name="fullName" required placeholder="Digite seu nome completo" />
      </label>
      <button type="submit">Registrar</button>
    </form>
  </div>` : ''}

  ${(req.user.role === 'professor' || req.user.role === 'admin') && activeSession && activeSession.active ? `<div class="card">
    <h2>📝 Marcar Presença por Nome</h2>
    <form id="mark-attendance-form">
      <label>
        Nome do Aluno
        <input id="mark-fullName-input" name="fullName" required placeholder="Digite o nome completo do aluno" />
      </label>
      <button type="submit">Marcar</button>
    </form>
    <form method="POST" action="/class/${classId}/end" style="margin-top: 12px;">
      <button type="submit" class="btn-danger">🛑 Encerrar Chamada</button>
    </form>
  </div>` : ''}

  ${timeline.rows.length > 0 ? `<div class="card">
    <h2>📊 Histórico de Sessões</h2>
    <ul>${timelineList}</ul>
  </div>` : ''}

  <a href="/classes" class="back-link">← Voltar às Salas</a>
</div>

<script>
  // Modal de erro de presença
  const modal = document.createElement('div');
  modal.id = 'attendance-error-modal';
  modal.style.cssText = \`
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9999;
    justify-content: center;
    align-items: center;
  \`;
  modal.innerHTML = \`
    <div style="background: var(--bg-secondary); padding: 32px; border-radius: 12px; max-width: 400px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
      <div id="modal-icon" style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <h2 id="modal-title" style="margin: 0 0 12px 0; color: var(--text-primary);">Erro</h2>
      <p id="modal-message" style="margin: 0 0 24px 0; color: var(--text-secondary); line-height: 1.5;"></p>
      <button onclick="document.getElementById('attendance-error-modal').style.display = 'none'" style="padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Entendi</button>
    </div>
  \`;
  document.body.appendChild(modal);

  function showErrorModal(title, message, icon = '⚠️') {
    document.getElementById('modal-icon').textContent = icon;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    modal.style.display = 'flex';
  }

  // Fechar modal ao clicar fora
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Formulário de presença via AJAX
  const attendanceForm = document.getElementById('attendance-form');
  if (attendanceForm) {
    attendanceForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const fullName = document.getElementById('fullName-input').value;
      
      try {
        const response = await fetch('/class/${classId}/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'fullName=' + encodeURIComponent(fullName)
        });
        
        const data = await response.json();
        
        if (data.success) {
          showErrorModal('✅ Sucesso!', 'Sua presença foi registrada com sucesso!', '✅');
          attendanceForm.reset();
          refreshAttendance();
          setTimeout(() => { modal.style.display = 'none'; }, 2000);
        } else {
          if (data.error === 'duplicate_name') {
            showErrorModal(
              '❌ Nome Duplicado',
              'Este nome já foi registrado nesta chamada. Você não pode se registrar com um nome já utilizado por outro aluno.',
              '❌'
            );
          } else if (data.error === 'already_registered') {
            showErrorModal(
              '⚠️ Já Registrado',
              data.message,
              '⚠️'
            );
          } else {
            showErrorModal('❌ Erro', data.error || 'Erro ao registrar presença', '❌');
          }
        }
      } catch (err) {
        console.error(err);
        showErrorModal('❌ Erro', 'Erro ao registrar presença. Tente novamente.', '❌');
      }
    });
  }

  // Formulário do professor para marcar presença
  const markAttendanceForm = document.getElementById('mark-attendance-form');
  if (markAttendanceForm) {
    markAttendanceForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const fullName = document.getElementById('mark-fullName-input').value;
      
      try {
        const response = await fetch('/class/${classId}/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'fullName=' + encodeURIComponent(fullName)
        });
        
        const data = await response.json();
        
        if (data.success) {
          showErrorModal('✅ Presença Marcada!', 'Presença do aluno foi registrada com sucesso!', '✅');
          markAttendanceForm.reset();
          refreshAttendance();
          setTimeout(() => { modal.style.display = 'none'; }, 2000);
        } else {
          if (data.error === 'duplicate_name') {
            showErrorModal(
              '⚠️ Já Registrado',
              'Este aluno já teve sua presença marcada nesta chamada.',
              '⚠️'
            );
          } else {
            showErrorModal('❌ Erro', data.error || data.message || 'Erro ao marcar presença', '❌');
          }
        }
      } catch (err) {
        console.error(err);
        showErrorModal('❌ Erro', 'Erro ao marcar presença. Tente novamente.', '❌');
      }
    });
  }

  async function refreshAttendance() {
    try {
      const res = await fetch('/class/${classId}/attendees');
      if (!res.ok) return;
      const data = await res.json();
      const list = document.getElementById('attendance-list');
      if (!data.length) {
        list.parentElement.innerHTML = '<div class="empty-state"><p>Nenhuma presença registrada ainda</p></div>';
        return;
      }
      list.innerHTML = data.map(item => \`<li>
        <div>
          <strong>\${item.student_name || item.username}</strong>
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">⏰ \${new Date(item.login_at).toLocaleString('pt-BR')}</div>
        </div>
      </li>\`).join('');
    } catch (e) {
      console.error('Erro ao atualizar:', e);
    }
  }
  
  if (document.getElementById('attendance-list')) {
    setInterval(refreshAttendance, 5000);
  }
</script>

</body>
</html>
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
    const schema = await getAttendanceSchema();
    const sessionRes = await db.query(`SELECT id FROM class_sessions WHERE class_id = $1 AND active = true LIMIT 1`, [classId]);
    if (!sessionRes.rowCount) return res.json([]);

    const sessionId = sessionRes.rows[0].id;
    const attendeesQuery = schema.hasClassSessionId
      ? {
          sql: `SELECT u.username, a.student_name, a.login_at FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_session_id = $1 ORDER BY a.login_at ASC`,
          params: [sessionId]
        }
      : {
          sql: `SELECT u.username, a.student_name, a.login_at FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_id = $1 ORDER BY a.login_at ASC`,
          params: [classId]
        };

    const attendances = await db.query(attendeesQuery.sql, attendeesQuery.params);
    console.log('[DEBUG] /class/:id/attendees - sessionId:', sessionId, 'rowCount:', attendances.rowCount);
    res.json(attendances.rows);
  } catch (err) {
    console.error('[ERROR] /class/:id/attendees:', err.message);
    res.status(500).json({ error: 'Falha ao buscar participantes', details: err.message });
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
      align-items: flex-start;
      background: var(--bg-dark);
      border-radius: 8px;
      margin-bottom: 8px;
      gap: 12px;
      flex-wrap: wrap;
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
    <li><a href="/subjects">📚 Matérias</a></li>
    <li><a href="/chamadas">📋 Chamadas</a></li>
    ${req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : ''}
    <li><a href="/logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">
  <div class="topbar">
    <h1>📋 Gerenciamento de Chamadas</h1>
  </div>

  <div class="card">
    <div class="form-group">
      <div style="flex: 1;">
        <label for="date">Filtrar por data (opcional)</label>
        <input id="date" type="date" />
      </div>
      <button id="load">Carregar</button>
    </div>
    <p style="color: var(--text-muted); margin-bottom: 16px; font-size: 13px;">Carregue as chamadas já existentes para abrir ou reabrir.</p>
    <div id="result"></div>
  </div>

  <a href="/dashboard" class="back-link">← Voltar ao Dashboard</a>
</div>

<script>
  function renderSessions(data, date) {
    const target = document.getElementById('result');

    if (!data || !data.length) {
      target.innerHTML = '<div class="result-empty"><p>📭 Nenhuma chamada encontrada.</p></div>';
      return;
    }

    target.innerHTML = '<h3 style="margin-bottom: 16px;">📚 Salas Encontradas</h3><ul>' + data.map(session => {
      const roomName = session.name || 'Sem nome';
      const dateLabel = session.start_time ? new Date(session.start_time).toLocaleString('pt-BR') : '-';
      const status = session.active
        ? '<span style="font-size:12px; color:#10b981;">🟢 Ativa</span>'
        : '<span style="font-size:12px; color:var(--text-muted);">⚪ Encerrada</span>';
      const exportDate = date || (session.start_time ? session.start_time.slice(0, 10) : 'sem-data');
      const reopenBtn = !session.active
        ? '<form method="POST" action="/chamadas/' + session.session_id + '/reopen" style="display:inline;margin:0;" onsubmit="return confirm(\'Deseja reabrir esta chamada?\');"><button type="submit" style="padding:8px 12px; font-size:12px;">🔄 Reabrir</button></form>'
        : '';

      return \`<li>
        <div>
          <strong>\${roomName}</strong>
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">⏰ \${dateLabel}</div>
          <div style="margin-top: 6px;">\${status}</div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <a href="/class/\${session.class_id}" style="padding: 8px 12px; background: var(--card-dark); border: 1px solid var(--border-color); border-radius: 6px; font-size: 12px;">📂 Abrir</a>
          <a href="/chamadas/\${session.session_id}/export?date=\${exportDate}&format=xlsx" style="padding: 8px 12px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 6px; color: white; font-size: 12px; border: none;">📥 Baixar</a>
          \${reopenBtn}
        </div>
      </li>\`;
    }).join('') + '</ul>';
  }

  async function loadSessions() {
    const date = document.getElementById('date').value;
    const endpoint = date ? '/chamadas/api/' + date : '/chamadas/api';
    try {
      const resp = await fetch(endpoint);
      if (!resp.ok) {
        console.error('Erro na resposta:', resp.status, resp.statusText);
        return alert('Falha ao carregar chamadas: ' + resp.status);
      }
      const data = await resp.json();
      console.log('Dados carregados:', data);
      renderSessions(data, date);
    } catch (err) {
      console.error('Erro ao carregar:', err);
      alert('Erro ao carregar chamadas: ' + err.message);
    }
  }

  document.getElementById('load').addEventListener('click', loadSessions);
  window.addEventListener('DOMContentLoaded', loadSessions);
</script>

</body>
</html>
  `);
});

app.get('/chamadas/api', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  try {
    const sessions = req.user.role === 'admin'
      ? await db.query(
          `SELECT s.id AS session_id, c.id AS class_id, c.name, s.active, s.start_time, s.end_time
           FROM class_sessions s
           JOIN classes c ON c.id = s.class_id
           ORDER BY s.start_time DESC
           LIMIT 120`
        )
      : await db.query(
          `SELECT s.id AS session_id, c.id AS class_id, c.name, s.active, s.start_time, s.end_time
           FROM class_sessions s
           JOIN classes c ON c.id = s.class_id
           WHERE c.professor_id = $1
           ORDER BY s.start_time DESC
           LIMIT 120`,
          [req.user.id]
        );
    console.log(`[DEBUG] /chamadas/api - Usuário ${req.user.id} (${req.user.role}) carregou ${sessions.rows.length} sessões`);
    res.json(sessions.rows);
  } catch (err) {
    console.error('[ERROR] /chamadas/api:', err.message);
    res.status(500).json({ error: 'Falha ao listar chamadas', details: err.message });
  }
});

app.get('/chamadas/api/:date', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB não conectado' });
  const date = req.params.date; // YYYY-MM-DD
  try {
    const sessions = req.user.role === 'admin'
      ? await db.query(
          `SELECT s.id AS session_id, c.id AS class_id, c.name, s.active, s.start_time, s.end_time
           FROM class_sessions s
           JOIN classes c ON c.id = s.class_id
           WHERE DATE(s.start_time) = $1
           ORDER BY s.start_time DESC`,
          [date]
        )
      : await db.query(
          `SELECT s.id AS session_id, c.id AS class_id, c.name, s.active, s.start_time, s.end_time
           FROM class_sessions s
           JOIN classes c ON c.id = s.class_id
           WHERE c.professor_id = $1 AND DATE(s.start_time) = $2
           ORDER BY s.start_time DESC`,
          [req.user.id, date]
        );
    console.log(`[DEBUG] /chamadas/api/${date} - Usuário ${req.user.id} (${req.user.role}) carregou ${sessions.rows.length} sessões para ${date}`);
    res.json(sessions.rows);
  } catch (err) {
    console.error('[ERROR] /chamadas/api/:date:', err.message);
    res.status(500).json({ error: 'Falha ao listar chamadas', details: err.message });
  }
});

app.get('/chamadas/:sessionId/export', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).send('Erro: DB não conectado.');
  const sessionId = req.params.sessionId;
  const date = req.query.date;
  try {
    const schema = await getAttendanceSchema();
    const sessionResult = await db.query(`SELECT s.id, s.class_id, c.name FROM class_sessions s JOIN classes c ON c.id = s.class_id WHERE s.id = $1`, [sessionId]);
    if (!sessionResult.rowCount) return res.status(404).send('Sessão não encontrada');

    const sessionData = sessionResult.rows[0];

    const exportQuery = schema.hasClassSessionId
      ? {
          sql: `SELECT COALESCE(a.student_name,u.username) as student_name, u.username as discord_username, a.login_at FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_session_id = $1 ORDER BY a.login_at ASC`,
          params: [sessionId]
        }
      : {
          sql: `SELECT COALESCE(a.student_name,u.username) as student_name, u.username as discord_username, a.login_at FROM attendances a LEFT JOIN users u ON a.student_id = u.id WHERE a.class_id = $1 ORDER BY a.login_at ASC`,
          params: [sessionData.class_id]
        };

    const attendances = await db.query(exportQuery.sql, exportQuery.params);

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
      res.setHeader('Content-Disposition', `attachment; filename="chamada-${sessionData.name.replace(/\s/g,'_')}-${date}.csv"`);
      res.send(csv);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao exportar chamada');
  }
});

app.post('/chamadas/:sessionId/reopen', ensureAuthenticated, ensureProfessor, async (req, res) => {
  if (!db) return res.status(500).send('Erro: DB não conectado.');
  const sessionId = parseInt(req.params.sessionId, 10);
  if (!sessionId) return res.status(400).send('Sessão inválida.');

  try {
    const targetSession = req.user.role === 'admin'
      ? await db.query(
          `SELECT s.id, s.class_id
           FROM class_sessions s
           JOIN classes c ON c.id = s.class_id
           WHERE s.id = $1`,
          [sessionId]
        )
      : await db.query(
          `SELECT s.id, s.class_id
           FROM class_sessions s
           JOIN classes c ON c.id = s.class_id
           WHERE s.id = $1 AND c.professor_id = $2`,
          [sessionId, req.user.id]
        );

    if (!targetSession.rowCount) return res.status(404).send('Sessão não encontrada.');

    const classId = targetSession.rows[0].class_id;

    await db.query('BEGIN');
    await db.query(
      `UPDATE class_sessions
       SET active = false, end_time = COALESCE(end_time, NOW())
       WHERE class_id = $1 AND active = true AND id <> $2`,
      [classId, sessionId]
    );
    await db.query(
      `UPDATE class_sessions
       SET active = true, end_time = NULL
       WHERE id = $1`,
      [sessionId]
    );
    await db.query('COMMIT');

    res.redirect(`/class/${classId}`);
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    console.error('Erro ao reabrir chamada:', err);
    res.status(500).send('Erro ao reabrir chamada');
  }
});

app.get('/classes', ensureAuthenticated, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  try {
    if (req.user.role === 'professor' || req.user.role === 'admin') {
      const subjectsRes = await db.query('SELECT id, name FROM subjects ORDER BY name');
      const subjectOptions = subjectsRes.rows.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

      const rooms = req.user.role === 'admin'
        ? await db.query(`
          SELECT c.id, c.name, c.subject_id, s.name AS subject_name, u.username AS professor_name
          FROM classes c
          LEFT JOIN subjects s ON c.subject_id = s.id
          LEFT JOIN users u ON c.professor_id = u.id
          ORDER BY c.id DESC
        `)
        : await db.query(`
          SELECT c.id, c.name, c.subject_id, s.name AS subject_name, u.username AS professor_name
          FROM classes c
          LEFT JOIN subjects s ON c.subject_id = s.id
          LEFT JOIN users u ON c.professor_id = u.id
          WHERE c.professor_id = $1
          ORDER BY c.id DESC
        `, [req.user.id]);

      const activeSessions = req.user.role === 'admin'
        ? await db.query(`SELECT class_id FROM class_sessions WHERE active = true`)
        : await db.query(`SELECT class_id FROM class_sessions WHERE active = true AND class_id IN (SELECT id FROM classes WHERE professor_id = $1)`, [req.user.id]);
      const activeSet = new Set(activeSessions.rows.map(r => r.class_id));

      const roomsList = rooms.rows.map(r => {
        const isActive = activeSet.has(r.id);
        const statusBadge = isActive ? '<span class="badge badge-active">🔴 Em Chamada</span>' : '<span class="badge badge-inactive">⚪ Disponível</span>';
        const subjectBadge = r.subject_name ? `<span style="color: #93c5fd; font-size: 12px;">📘 ${r.subject_name}</span>` : '<span style="color: #94a3b8; font-size: 12px;">📘 Sem matéria</span>';
        return `<li>
          <div>
            <strong>${r.name}</strong>
            <div style="margin-top: 8px;">${subjectBadge} ${statusBadge}</div>
            ${req.user.role === 'admin' ? `<div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">👨‍🏫 Prof. ${r.professor_name || 'Não definido'}</div>` : ''}
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="/class/${r.id}">Abrir</a>
            ${(req.user.role === 'professor' || req.user.role === 'admin') ? (isActive ? `<form method="POST" action="/class/${r.id}/end" style="display:inline; margin: 0;"><button type="submit" class="btn-danger">Encerrar</button></form>` : `<form method="POST" action="/class/${r.id}/start-session" style="display:inline; margin: 0;"><button type="submit">Iniciar</button></form>`) : ''}
            ${req.user.role === 'admin' ? `<form method="POST" action="/admin/class/${r.id}/delete" style="display:inline; margin: 0;" onsubmit="return confirm('Tem certeza que deseja excluir esta sala e todo o histórico de chamadas?');"><button type="submit" class="btn-danger">🗑️ Excluir</button></form>` : ''}
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

    form input,
    form select {
      flex: 1;
      padding: 12px 16px;
      background: var(--bg-dark);
      border: 1px solid var(--border-color);
      color: var(--text-light);
      border-radius: 8px;
      font-family: 'Poppins', sans-serif;
    }

    form select {
      min-width: 210px;
      cursor: pointer;
      transition: all 0.25s ease;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      background-image:
        linear-gradient(45deg, transparent 50%, var(--text-muted) 50%),
        linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
      background-position:
        calc(100% - 18px) calc(50% - 3px),
        calc(100% - 12px) calc(50% - 3px);
      background-size: 6px 6px, 6px 6px;
      background-repeat: no-repeat;
      padding-right: 34px;
    }

    form select:hover {
      border-color: var(--primary);
      background-color: rgba(99, 102, 241, 0.08);
    }

    form input:focus,
    form select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    form select option {
      background: var(--card-dark);
      color: var(--text-light);
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
    ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/subjects">📚 Matérias</a></li>' : ''}
    ${req.user.role === 'professor' || req.user.role === 'admin' ? '<li><a href="/chamadas">📋 Chamadas</a></li>' : ''}
    ${req.user.role === 'admin' ? '<li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>' : ''}
    <li><a href="/logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">
  <div class="topbar">
    <h1>🏫 Salas de Aula</h1>
  </div>

  ${req.user.role === 'professor' ? `<div class="card">
    <h2>➕ Criar Nova Sala</h2>
    <form method="POST" action="/class/start">
      <input name="name" required placeholder="Nome da sala" />
      <select name="subject_id">
        <option value="">Sem matéria</option>
        ${subjectOptions || ''}
      </select>
      <button type="submit">Criar Sala</button>
    </form>
    <p style="margin-top:10px;color:var(--text-muted);font-size:13px;">Gerencie matérias em <a href="/subjects" style='color:var(--primary);'>/subjects</a>.</p>
  </div>` : ''}

  <div class="card">
    <h2>${req.user.role === 'admin' ? '📚 Todas as Salas' : '📚 Minhas Salas'}</h2>
    <ul>${roomsList}</ul>
  </div>

  <a href="/dashboard" class="back-link">← Voltar ao Dashboard</a>
</div>

</body>
</html>
      `;
      res.send(html);
    } else {
      const classes = await db.query(`
        SELECT c.id, c.name, c.subject_id, s.name AS subject_name, u.username AS professor_name
        FROM class_sessions cs
        JOIN classes c ON cs.class_id = c.id
        JOIN users u ON c.professor_id = u.id
        LEFT JOIN subjects s ON c.subject_id = s.id
        WHERE cs.active = true
        ORDER BY cs.start_time DESC
      `);
      
      const classList = classes.rows.map(c => `<li>
        <div>
          <strong>${c.name}</strong>
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">👨‍🏫 Prof. ${c.professor_name} • 📘 ${c.subject_name || 'Sem matéria'}</div>
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
  if (!db) return res.json({ success: false, error: 'DB não conectado' });
  const classId = req.params.id;
  const fullName = req.body.fullName?.trim();

  if (!fullName) return res.status(400).json({ success: false, error: 'Informe o nome completo do aluno para marcar presença.' });

  try {
    const schema = await getAttendanceSchema();
    const sessionRes = await db.query(`SELECT id FROM class_sessions WHERE class_id = $1 AND active = true LIMIT 1`, [classId]);
    if (!sessionRes.rowCount) return res.status(400).json({ success: false, error: 'Não há chamada ativa para esta sala.' });

    const sessionId = sessionRes.rows[0].id;

    const existing = schema.hasClassSessionId
      ? await db.query(`SELECT id FROM attendances WHERE class_session_id = $1 AND student_name = $2 LIMIT 1`, [sessionId, fullName])
      : await db.query(`SELECT id FROM attendances WHERE class_id = $1 AND student_name = $2 LIMIT 1`, [classId, fullName]);

    if (existing.rowCount) {
      await db.query(`UPDATE attendances SET login_at = NOW() WHERE id = $1`, [existing.rows[0].id]);
    } else {
      if (schema.hasClassSessionId && schema.hasClassId) {
        await db.query(`INSERT INTO attendances (class_session_id, class_id, student_name, login_at) VALUES ($1, $2, $3, NOW())`, [sessionId, classId, fullName]);
      } else if (schema.hasClassSessionId) {
        await db.query(`INSERT INTO attendances (class_session_id, student_name, login_at) VALUES ($1, $2, NOW())`, [sessionId, fullName]);
      } else {
        await db.query(`INSERT INTO attendances (class_id, student_name, login_at) VALUES ($1, $2, NOW())`, [classId, fullName]);
      }
    }

    res.json({ success: true, message: 'Presença marcada com sucesso' });
  } catch (err) {
    console.error('Erro ao marcar presença por nome:', err);
    if (err.code === '23505' && err.constraint === 'attendances_class_session_name_idx') {
      return res.status(400).json({
        success: false,
        error: 'duplicate_name',
        message: 'Este nome já foi registrado nesta chamada.'
      });
    }
    res.status(500).json({ success: false, error: 'Erro ao registrar presença por nome' });
  }
});

app.get('/admin/dashboard', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  try {
    const sessions = await db.query(`
      SELECT s.id, s.class_id, c.name, s.start_time, s.end_time, s.active, COUNT(a.id) as total_presencas, u.username as professor_name
      FROM class_sessions s
      JOIN classes c ON c.id = s.class_id
      JOIN users u ON u.id = c.professor_id
      LEFT JOIN attendances a ON a.class_session_id = s.id
      GROUP BY s.id, c.name, s.class_id, u.username
      ORDER BY s.start_time DESC
    `);

    const totalSessions = sessions.rowCount;
    const activeSessions = sessions.rows.filter(s => s.active).length;
    const totalAttendances = sessions.rows.reduce((sum, s) => sum + parseInt(s.total_presencas), 0);

    const sessionsList = sessions.rows.map(s => `<li>
      <div>
        <strong>${s.name}</strong>
        <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">
          👨‍🏫 ${s.professor_name} | 📅 ${new Date(s.start_time).toLocaleString('pt-BR')} | 👥 ${s.total_presencas} presenças
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <span class="status-badge ${s.active ? 'active' : 'inactive'}">${s.active ? '🟢 Ativa' : '⚫ Encerrada'}</span>
        <form method="POST" action="/admin/delete-session/${s.id}" style="display:inline; margin: 0;" onsubmit="return confirm('Tem certeza que deseja deletar esta sessão?');">
          <button type="submit" class="btn-delete">🗑️ Deletar</button>
        </form>
      </div>
    </li>`).join('');

    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presença Plus | Admin</title>
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

    .topbar p {
      color: var(--text-muted);
      margin-top: 8px;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .metric-card {
      background: var(--card-dark);
      border: 1px solid var(--border-color);
      padding: 24px;
      border-radius: 14px;
      text-align: center;
    }

    .metric-card h3 {
      font-size: 36px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }

    .metric-card p {
      color: var(--text-muted);
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
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

    .status-badge {
      display: inline-block;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-badge.active {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
    }

    .status-badge.inactive {
      background: rgba(100, 116, 139, 0.2);
      color: var(--text-muted);
    }

    button, .btn-delete {
      padding: 8px 14px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-family: 'Poppins', sans-serif;
      font-size: 12px;
      transition: all 0.3s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(99, 102, 241, 0.3);
    }

    .btn-delete {
      background: linear-gradient(135deg, var(--danger), #dc2626);
      padding: 8px 12px;
    }

    .btn-delete:hover {
      box-shadow: 0 5px 20px rgba(239, 68, 68, 0.3);
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
      li {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  </style>
</head>
<body>

<div class="sidebar">
  <h2>✨ Presença Plus</h2>
  <ul class="nav-menu">
    <li><a href="/admin/dashboard">⚙️ Painel Admin</a></li>
    <li><a href="/dashboard">📊 Dashboard</a></li>
    <li><a href="/classes">🏫 Salas de Aula</a></li>
    <li><a href="/subjects">📚 Matérias</a></li>
    <li><a href="/chamadas">📋 Chamadas</a></li>
    <li><a href="/admin/db-check">🧪 Diagnóstico DB</a></li>
    <li><a href="/logout">🚪 Sair</a></li>
  </ul>
</div>

<div class="content">
  <div class="topbar">
    <h1>⚙️ Painel de Administração</h1>
    <p>Controle e gestão de todas as chamadas do sistema</p>
  </div>

  <div class="metrics">
    <div class="metric-card">
      <h3>${totalSessions}</h3>
      <p>Total de Sessões</p>
    </div>
    <div class="metric-card">
      <h3>${activeSessions}</h3>
      <p>Sessões Ativas</p>
    </div>
    <div class="metric-card">
      <h3>${totalAttendances}</h3>
      <p>Total de Presenças</p>
    </div>
  </div>

  <div class="card">
    <h2>📋 Todas as Chamadas</h2>
    <ul>${sessionsList || '<li style="color: var(--text-muted);">Nenhuma sessão registrada</li>'}</ul>
  </div>

  <a href="/dashboard" class="back-link">← Voltar ao Dashboard</a>
</div>

</body>
</html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar dashboard admin');
  }
});

app.post('/admin/subject/:id/delete', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const subjectId = parseInt(req.params.id, 10);
  if (!subjectId) return res.status(400).send('ID de matéria inválido.');

  try {
    await db.query('BEGIN');
    await db.query(`UPDATE classes SET subject_id = NULL WHERE subject_id = $1`, [subjectId]);
    await db.query(`DELETE FROM subjects WHERE id = $1`, [subjectId]);
    await db.query('COMMIT');
    res.redirect('/subjects');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).send('Erro ao excluir matéria');
  }
});

app.post('/admin/class/:id/delete', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const classId = parseInt(req.params.id, 10);
  if (!classId) return res.status(400).send('ID de sala inválido.');

  try {
    await db.query('BEGIN');

    // Remove presenças ligadas às sessões da sala
    await db.query(`
      DELETE FROM attendances a
      USING class_sessions cs
      WHERE a.class_session_id = cs.id
        AND cs.class_id = $1
    `, [classId]);

    // Compatibilidade com bancos antigos que ainda possuam attendances.class_id
    const legacyClassIdColumn = await db.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'attendances'
        AND column_name = 'class_id'
      LIMIT 1
    `);
    if (legacyClassIdColumn.rowCount) {
      await db.query(`DELETE FROM attendances WHERE class_id = $1`, [classId]);
    }

    // Remove sessões da sala
    await db.query(`DELETE FROM class_sessions WHERE class_id = $1`, [classId]);

    await db.query(`DELETE FROM classes WHERE id = $1`, [classId]);
    await db.query('COMMIT');
    res.redirect('/classes');
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    console.error('Erro ao excluir sala:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint
    });
    res.status(500).send('Erro ao excluir sala');
  }
});

app.post('/admin/delete-session/:sessionId', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (!db) return res.send('Erro: DB não conectado.');
  const sessionId = req.params.sessionId;
  try {
    await db.query(`DELETE FROM attendances WHERE class_session_id = $1`, [sessionId]);
    await db.query(`DELETE FROM class_sessions WHERE id = $1`, [sessionId]);
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao deletar sessão');
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