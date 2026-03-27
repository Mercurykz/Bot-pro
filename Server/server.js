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
  <html>
  <head>
    <title>Sistema de Presença</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: linear-gradient(135deg, #0f172a, #1e3a8a);
        color: white;
      }

      .container {
        display: flex;
        height: 100vh;
        align-items: center;
        justify-content: space-around;
        padding: 40px;
      }

      .left {
        max-width: 500px;
      }

      h1 {
        font-size: 42px;
        margin-bottom: 20px;
      }

      p {
        font-size: 18px;
        color: #cbd5f5;
      }

      .btn {
        display: inline-block;
        margin-top: 30px;
        padding: 15px 25px;
        background: #5865F2;
        color: white;
        border-radius: 10px;
        text-decoration: none;
        font-size: 18px;
        transition: 0.2s;
      }

      .btn:hover {
        background: #4752c4;
      }

      .right {
        text-align: center;
      }

      .card {
        background: rgba(255,255,255,0.05);
        padding: 20px;
        border-radius: 15px;
        margin: 10px;
      }

      .features {
        display: flex;
        gap: 20px;
        margin-top: 40px;
      }

    </style>
  </head>

  <body>
    <div class="container">

      <div class="left">
        <h1>📊 Controle de Presença via Discord</h1>
        <p>Gerencie a frequência dos alunos de forma simples, rápida e automática.</p>

        <a class="btn" href="/login">
          🚀 Entrar com Discord
        </a>

        <div class="features">
          <div class="card">
            ⚡ Registro rápido
          </div>

          <div class="card">
            📊 Dashboard completo
          </div>

          <div class="card">
            📅 Histórico por dia
          </div>
        </div>
      </div>

      <div class="right">
        <h2>💡 Simples. Rápido. Poderoso.</h2>
      </div>

    </div>
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
      font-family: Arial;
      background: #0f172a;
      color: white;
      padding: 20px;
    }

    .card {
      background: #1e293b;
      padding: 20px;
      margin: 10px 0;
      border-radius: 10px;
    }

    a {
      color: #38bdf8;
      text-decoration: none;
    }
  </style>

  <h1>👋 ${req.user.username}</h1>
  <h2>Seus servidores</h2>

  ${guilds.map(g => `
    <div class="card">
      <strong>${g.name}</strong><br>
      <a href="/guild/${g.id}">Abrir painel</a>
    </div>
  `).join('')}
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
          margin-top: 20px;
        }

        td, th {
          padding: 10px;
          border-bottom: 1px solid #333;
        }

        tr:hover {
          background: #1e293b;
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
