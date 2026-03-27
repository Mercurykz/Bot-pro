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
app.get('/dashboard', (req, res) => {
  if (!req.user) return res.redirect('/');

  const guilds = req.user.guilds
    .filter(g => (g.permissions & 0x8) === 0x8);

  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <style>
      body {
        margin: 0;
        font-family: 'Segoe UI';
        display: flex;
        transition: 0.3s;
      }

      body.dark {
        background: #0f172a;
        color: white;
      }

      body.light {
        background: #f1f5f9;
        color: black;
      }

      .sidebar {
        width: 250px;
        height: 100vh;
        background: #020617;
        padding: 20px;
        color: white;
      }

      .sidebar h2 {
        color: #38bdf8;
      }

      .content {
        flex: 1;
        padding: 20px;
      }

      .card {
        background: #1e293b;
        padding: 15px;
        border-radius: 12px;
        margin-bottom: 15px;
        transition: 0.3s;
      }

      .card:hover {
        transform: translateY(-5px);
      }

      .toggle {
        cursor: pointer;
        margin-bottom: 20px;
        display: inline-block;
        padding: 8px 15px;
        border-radius: 8px;
        background: #38bdf8;
        color: black;
      }

      a {
        color: #38bdf8;
        text-decoration: none;
      }

      canvas {
        margin-top: 30px;
        background: white;
        border-radius: 10px;
        padding: 10px;
      }
    </style>
  </head>

  <body class="dark">

    <div class="sidebar">
      <h2>📊 Presença</h2>
      <p>${req.user.username}</p>
    </div>

    <div class="content">

      <div class="toggle" onclick="toggleTheme()">🌙/☀️ Alternar tema</div>

      <h1>Seus Servidores</h1>

      ${guilds.map(g => `
        <div class="card">
          <h3>${g.name}</h3>
          <a href="/guild/${g.id}">Abrir</a>
        </div>
      `).join('')}

      <h2>📈 Estatísticas</h2>
      <canvas id="chart"></canvas>

    </div>

    <script>
      function toggleTheme() {
        document.body.classList.toggle('dark');
        document.body.classList.toggle('light');
      }

      const ctx = document.getElementById('chart');

      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
          datasets: [{
            label: 'Presenças',
            data: [12, 19, 8, 15, 10],
          }]
        }
      });
    </script>

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

  const guilds = req.user.guilds
    .filter(g => (g.permissions & 0x8) === 0x8);

  res.send(`
  <style>
    body {
      margin: 0;
      font-family: Arial;
      background: #0f172a;
      color: white;
      display: flex;
    }

    .sidebar {
      width: 250px;
      background: #020617;
      height: 100vh;
      padding: 20px;
    }

    .sidebar h2 {
      color: #38bdf8;
    }

    .content {
      flex: 1;
      padding: 20px;
    }

    .card {
      background: #1e293b;
      padding: 15px;
      border-radius: 10px;
      margin-bottom: 10px;
    }

    a {
      color: #38bdf8;
      text-decoration: none;
    }
  </style>

  <div class="sidebar">
    <h2>📊 Dashboard</h2>
    <p>${req.user.username}</p>
  </div>

  <div class="content">
    <h1>Seus servidores</h1>

    ${guilds.map(g => `
      <div class="card">
        <h3>${g.name}</h3>
        <a href="/guild/${g.id}">Abrir</a>
      </div>
    `).join('')}
  </div>
  `);
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
