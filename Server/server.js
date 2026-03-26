require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('./routes/auth');

const app = express();

app.use(session({
  secret: 'segredo',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// login
app.get('/login', passport.authenticate('discord'));

// callback
app.get('/callback',
  passport.authenticate('discord', {
    failureRedirect: '/'
  }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

// dashboard
app.get('/dashboard', (req, res) => {
  if (!req.user) return res.redirect('/');

  res.send(`
    <h1>Logado como ${req.user.username}</h1>
    <img src="https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png"/>
    <pre>${JSON.stringify(req.user.guilds, null, 2)}</pre>
  `);
});

// home
app.get('/', (req, res) => {
  res.send('<a href="/login">Login com Discord</a>');
});

// ✅ correto
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🌐 Painel com login rodando na porta ' + PORT);
});
