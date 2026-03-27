require('dotenv').config();
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const db = require('./database');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// 🧠 cooldown em memória
const cooldown = new Map();

client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot logado como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'presenca') {

    const userId = interaction.user.id;
    const username = interaction.user.username;
    const guildId = interaction.guild.id;

    // 🚫 COOLDOWN (5 segundos)
    if (cooldown.has(userId)) {
      return interaction.reply({
        content: '⏳ Aguarde alguns segundos antes de tentar novamente.',
        ephemeral: true
      });
    }

    cooldown.set(userId, true);
    setTimeout(() => cooldown.delete(userId), 5000);

    const hoje = new Date().toISOString().split('T')[0];

    db.get(
      `SELECT * FROM presencas 
       WHERE user_id = ? AND guild_id = ? AND data LIKE ?`,
      [userId, guildId, hoje + '%'],
      async (err, row) => {

        if (row) {
          return interaction.reply({
            content: '⚠️ Você já marcou presença hoje!',
            ephemeral: true
          });
        }

        // salva presença
        db.run(
          `INSERT INTO presencas (user_id, username, guild_id, data)
           VALUES (?, ?, ?, ?)`,
          [userId, username, guildId, new Date().toISOString()]
        );

        // 📊 TOTAL DE PRESENÇAS DO USUÁRIO
        db.get(
          `SELECT COUNT(*) as total FROM presencas 
           WHERE user_id = ? AND guild_id = ?`,
          [userId, guildId],
          async (err, result) => {

            const embed = new EmbedBuilder()
              .setTitle('✅ Presença Registrada')
              .setDescription(`Bem-vindo, **${username}**!`)
              .addFields(
                { name: '📅 Hoje', value: 'Presença confirmada', inline: true },
                { name: '📊 Total', value: String(result.total), inline: true }
              )
              .setColor('#5865F2')
              .setFooter({ text: 'Sistema de Presença' })
              .setTimestamp();

            await interaction.reply({ embeds: [embed] });
          }
        );

      }
    );

  }
});

client.login(process.env.TOKEN);
