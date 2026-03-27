require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('./auth');
const db = require('./database');

const app = express();

app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'segredo',
  resave: false,
  saveUninitialized: false
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
    <title>Sistema de Presença</title>

    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        font-family: Arial;
      }

      body {
        background: linear-gradient(135deg, #1e3a8a, #3b82f6);
        color: white;
      }

      header {
        display: flex;
        justify-content: space-between;
        padding: 20px 60px;
      }

      .hero {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 80px;
      }

      h1 {
        font-size: 40px;
      }

      p {
        margin: 20px 0;
      }

      .btn {
        background: #5865F2;
        padding: 15px 30px;
        border-radius: 10px;
        color: white;
        text-decoration: none;
        font-weight: bold;
      }

      .cards {
        display: flex;
        gap: 20px;
        padding: 40px;
        background: white;
        color: black;
      }

      .card {
        background: #f1f5f9;
        padding: 20px;
        border-radius: 12px;
        flex: 1;
      }
    </style>
  </head>

  <body>

    <header>
      <h2>✔ Sistema de Presença</h2>
    </header>

    <section class="hero">
      <div>
        <h1>Controle de Presença via Discord</h1>
        <p>Gerencie alunos de forma simples e automática.</p>

        <a href="/login" class="btn">
          Login com Discord
        </a>
      </div>
    </section>

    <section class="cards">
      <div class="card">
        <h3>✔ Rápido</h3>
        <p>Registro com comando no Discord</p>
      </div>

      <div class="card">
        <h3>📊 Dashboard</h3>
        <p>Visual moderno e dados em tempo real</p>
      </div>

      <div class="card">
        <h3>📄 Relatórios</h3>
        <p>Acompanhe presença facilmente</p>
      </div>
    </section>

  </body>
  </html>
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
app.get('/dashboard', (req, res) => {
  if (!req.user) return res.redirect('/');

  db.all(`
    SELECT DATE(data) as dia, COUNT(*) as total
    FROM presencas
    GROUP BY dia
    ORDER BY dia ASC
  `, (err, rows) => {

    const labels = rows.map(r => r.dia);
    const valores = rows.map(r => r.total);

    db.get(`SELECT COUNT(*) as total FROM presencas`, (err, totalGeral) => {

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
  },
  options: {
    plugins: {
      legend: { display: true }
    }
  }
});
</script>

</body>
</html>
      `);
    });

  });
});
// PÁGINA DO SERVIDOR
app.get('/guild/:id', (req, res) => {
  if (!req.user) return res.redirect('/');

  const guildId = req.params.id;

  db.all(
    `SELECT * FROM presencas WHERE guild_id = ?`,
    [guildId],
    (err, rows) => {

      const lista = rows.map(r => `
        <tr>
          <td>${r.username}</td>
          <td>${new Date(r.data).toLocaleString()}</td>
        </tr>
      `).join('');

      res.send(`
      <style>
        body {
          font-family: 'Segoe UI';
          background: #0f172a;
          color: white;
          padding: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background: #1e293b;
          border-radius: 10px;
          overflow: hidden;
        }

        th, td {
          padding: 12px;
        }

        tr {
          transition: 0.3s;
        }

        tr:hover {
          background: #334155;
        }

        th {
          background: #020617;
        }
      </style>

      <h1>📊 Presenças</h1>

      <table>
        <tr>
          <th>Usuário</th>
          <th>Data</th>
        </tr>
        ${lista}
      </table>

      <p>Total: ${rows.length}</p>
      `);
    }
  );
});
// START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🌐 Server rodando na porta ' + PORT);
});
