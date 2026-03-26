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
    res.redirect('/dashboard'); // 👉 vai pra dashboard
  }
);

// DASHBOARD (AGORA EXISTE 🔥)
app.get('/dashboard', (req, res) => {
  if (!req.user) return res.redirect('/');

  res.send(`
    <h1>Logado como ${req.user.username}</h1>
    <img src="https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png"/>
    <p>Login feito com sucesso ✅</p>
  `);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🌐 Server rodando na porta ' + PORT);
});
