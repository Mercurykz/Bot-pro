require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const db = require('./database');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot logado como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'presenca') {

    const hoje = new Date().toISOString().split('T')[0];

    db.get(
      `SELECT * FROM presencas 
       WHERE user_id = ? AND guild_id = ? AND data LIKE ?`,
      [interaction.user.id, interaction.guild.id, hoje + '%'],
      async (err, row) => {

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

        await interaction.reply('✅ Presença registrada!');
      }
    );

  }
});

client.login(process.env.TOKEN);
