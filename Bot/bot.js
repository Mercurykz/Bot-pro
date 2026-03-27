require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const db = require('./database');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot logado como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'presenca') {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const guildId = interaction.guild.id;
    const data = new Date().toISOString();

    db.run(
      `INSERT INTO presencas (user_id, username, guild_id, data)
       VALUES (?, ?, ?, ?)`,
      [userId, username, guildId, data]
    );

    await interaction.reply('✅ Presença registrada!');
  }
});
const hoje = new Date().toISOString().split('T')[0];

db.get(
  `SELECT * FROM presencas 
   WHERE user_id = ? AND guild_id = ? AND data LIKE ?`,
  [interaction.user.id, interaction.guild.id, hoje + '%'],
  (err, row) => {

    if (row) {
      return interaction.reply('⚠️ Você já marcou presença hoje!');
    }

    db.run(
      `INSERT INTO presencas (user_id, username, guild_id, data)
       VALUES (?, ?, ?, ?)`,
      [
        interaction.user.id,
        interaction.user.username,
        interaction.guild.id,
        new Date().toISOString()
      ]
    );

    interaction.reply('✅ Presença registrada!');
  }
);

client.login(process.env.TOKEN);
