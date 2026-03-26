const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send(`
    <h1>🚀 Painel do Bot</h1>
    <a href="/login">Login com Discord</a>
  `);
}); // ✅ FECHOU AQUI

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Server rodando');
});
