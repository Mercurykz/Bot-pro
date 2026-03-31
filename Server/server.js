require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('./auth');
const db = require('./database');

const app = express();

app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));

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

  try {

    // 📊 gráfico
    const result = await db.query(`
  SELECT 
    DATE(data) as dia,
    COUNT(*) as total
  FROM presencas
  GROUP BY DATE(data)
  ORDER BY dia ASC
`);

    const rows = result.rows;
    const labels = rows.map(r => r.dia);
    const valores = rows.map(r => r.total);

    // 📈 total geral
    const totalResult = await db.query(`
      SELECT COUNT(*) as total FROM presencas
    `);

    const totalGeral = totalResult.rows[0] || { total: 0 };

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
  <p>${req.user.username}</p>
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
    console.error(err);
    res.send('Erro no dashboard');
  }
});


// GUILD (AGORA COM POSTGRES)
app.get('/guild/:id', async (req, res) => {
  if (!req.user) return res.redirect('/');

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

// START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🌐 Server rodando na porta ' + PORT);
});