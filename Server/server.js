const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

db.run(`
  CREATE TABLE IF NOT EXISTS configs (
    guild_id TEXT PRIMARY KEY,
    prefix TEXT
  )
`);
const express = require('express');
const session = require('express-session');
const passport = require('./routes/auth');

const app = express();

// ⚠️ importante pro form funcionar depois
app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', 1); // MUITO IMPORTANTE

app.use(session({
  secret: 'segredo',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: 'none'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// HOME
app.get('/', (req, res) => {
  res.send('<a href="/login">Login com Discord</a>');
});

// LOGIN
app.get('/login', passport.authenticate('discord'));

// CALLBACK
app.get('/callback',
  passport.authenticate('discord', {
    failureRedirect: '/'
  }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

// DASHBOARD
app.get('/dashboard', (req, res) => {
  if (!req.user) return res.redirect('/');

  const guilds = req.user.guilds
    .filter(g => (g.permissions & 0x8) === 0x8);

  res.send(`
    <h1>Bem-vindo ${req.user.username}</h1>
    <h2>Seus servidores:</h2>
    <ul>
      ${guilds.map(g => `
        <li>
          <a href="/guild/${g.id}">${g.name}</a>
        </li>
      `).join('')}
    </ul>
  `);
});

// ✅ ROTA CORRETA (fora do listen)
app.get('/guild/:id', (req, res) => {
  if (!req.user) return res.redirect('/');

  const guild = req.user.guilds.find(g => g.id === req.params.id);

  if (!guild) return res.send('Servidor não encontrado');

  res.send(`
    <h1>Configurar: ${guild.name}</h1>

    <form method="POST" action="/guild/${guild.id}">
      <label>Prefixo:</label>
      <input name="prefix" placeholder="!"/>

      <button type="submit">Salvar</button>
    </form>
  `);
});

// START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🌐 Server rodando na porta ' + PORT);
});
app.post('/guild/:id', (req, res) => {
  const { prefix } = req.body;
  const guildId = req.params.id;

  db.run(
    `INSERT OR REPLACE INTO configs (guild_id, prefix) VALUES (?, ?)`,
    [guildId, prefix],
    () => {
      res.send('✅ Config salva!');
    }
  );
});
