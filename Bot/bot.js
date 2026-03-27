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

client.login(process.env.TOKEN);
