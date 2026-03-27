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
    <h1>🚀 Sistema de Presença</h1>
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
app.get('/dashboard', (req, res) => {
  if (!req.user) return res.redirect('/');

  const guilds = req.user.guilds
    .filter(g => (g.permissions & 0x8) === 0x8);

  res.send(`
    <h1>Bem-vindo ${req.user.username}</h1>
    <h2>Servidores:</h2>
    <ul>
      ${guilds.map(g => `
        <li>
          ${g.name}
          <a href="/guild/${g.id}">Abrir</a>
        </li>
      `).join('')}
    </ul>
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
        <h1>📊 Presenças</h1>

        <table border="1">
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
