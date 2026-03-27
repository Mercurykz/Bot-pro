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
  <style>
    body {
      margin: 0;
      font-family: Arial;
      background: linear-gradient(135deg, #1e3a8a, #0f172a);
      color: white;
      text-align: center;
      padding-top: 100px;
    }

    button {
      background: #5865F2;
      border: none;
      padding: 15px 30px;
      border-radius: 10px;
      color: white;
      font-size: 18px;
      cursor: pointer;
    }
  </style>

  <h1>🚀 Sistema de Presença</h1>
  <p>Controle alunos via Discord</p>

  <a href="/login">
    <button>Login com Discord</button>
  </a>
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
          font-family: Arial;
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
          border-bottom: 1px solid #334155;
        }

        th {
          background: #020617;
        }

        tr:hover {
          background: #334155;
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
