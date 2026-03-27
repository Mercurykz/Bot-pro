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
        font-family: Arial, sans-serif;
      }

      body {
        background: linear-gradient(135deg, #1e3a8a, #3b82f6);
        color: white;
      }

      header {
        display: flex;
        justify-content: space-between;
        padding: 20px 60px;
        align-items: center;
      }

      header h1 {
        font-size: 20px;
      }

      nav a {
        margin-left: 20px;
        color: white;
        text-decoration: none;
        opacity: 0.8;
      }

      .hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 80px 60px;
      }

      .hero-text {
        max-width: 500px;
      }

      .hero h2 {
        font-size: 42px;
        margin-bottom: 20px;
      }

      .hero p {
        margin-bottom: 30px;
        opacity: 0.9;
      }

      .btn {
        background: #5865F2;
        padding: 15px 30px;
        border-radius: 10px;
        color: white;
        text-decoration: none;
        font-weight: bold;
        display: inline-block;
      }

      .cards {
        display: flex;
        justify-content: center;
        gap: 20px;
        padding: 40px;
        background: #f1f5f9;
        color: black;
      }

      .card {
        background: white;
        padding: 20px;
        border-radius: 12px;
        width: 250px;
        box-shadow: 0 10px 20px rgba(0,0,0,0.1);
      }

      .card h3 {
        margin-bottom: 10px;
      }

      .illustration {
        width: 500px;
      }

    </style>
  </head>

  <body>

    <header>
      <h1>✔ Sistema de Presença</h1>
      <nav>
        <a href="#">Sobre</a>
        <a href="#">Contato</a>
      </nav>
    </header>

    <section class="hero">
      <div class="hero-text">
        <h2>Controle de Presença via Discord</h2>
        <p>Gerencie a frequência dos alunos de forma fácil e automática.</p>

        <a class="btn" href="/login">
          Login com Discord
        </a>
      </div>

      <div>
        <img class="illustration" src="https://cdn-icons-png.flaticon.com/512/906/906175.png"/>
      </div>
    </section>

    <section class="cards">
      <div class="card">
        <h3>✔ Registro Rápido</h3>
        <p>Marque presença com um comando no Discord.</p>
      </div>

      <div class="card">
        <h3>📊 Painel Completo</h3>
        <p>Visualize dados e relatórios em tempo real.</p>
      </div>

      <div class="card">
        <h3>📄 Relatórios</h3>
        <p>Exporte e acompanhe frequência facilmente.</p>
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
