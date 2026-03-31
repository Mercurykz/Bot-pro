require('dotenv').config();
const { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./database');

// 🔥 cria cliente
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

  if (interaction.commandName === 'chamada') {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: '⚠️ Este comando só pode ser usado dentro do servidor.',
        ephemeral: true
      });
    }

    const roles = interaction.member?.roles?.cache;
    const alunoRoleId = process.env.ALUNO_ROLE_ID;
    const professorRoleId = process.env.PROFESSOR_ROLE_ID;

    if (alunoRoleId && professorRoleId && roles) {
      const isAluno = roles.has(alunoRoleId);
      const isProfessor = roles.has(professorRoleId);
      const isAdmin = interaction.memberPermissions?.has('Administrator');

      if (!isAluno && !isProfessor && !isAdmin) {
        return interaction.reply({
          content: '⛔ Apenas aluno, professor ou admin podem usar este comando.',
          ephemeral: true
        });
      }
    }

    const appBaseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const chamadaUrl = `${appBaseUrl}/login`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Abrir Sistema de Chamada')
        .setStyle(ButtonStyle.Link)
        .setURL(chamadaUrl)
    );

    const embed = new EmbedBuilder()
      .setTitle('📋 Sistema de Chamada')
      .setDescription('Clique no botão abaixo para entrar no sistema atual de chamadas.')
      .setColor('#5865F2')
      .setFooter({ text: 'Presença Plus' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }

  if (interaction.commandName === 'presenca') {

    const userId = interaction.user.id;
    const username = interaction.user.username;
    const guildId = interaction.guild.id;

    // 🚫 COOLDOWN (5s)
    if (cooldown.has(userId)) {
      return interaction.reply({
        content: '⏳ Aguarde alguns segundos antes de tentar novamente.',
        ephemeral: true
      });
    }

    cooldown.set(userId, true);
    setTimeout(() => cooldown.delete(userId), 5000);

    try {
      const hoje = new Date().toISOString().split('T')[0];

      // 🔍 verifica se já marcou hoje
      const check = await db.query(
        `SELECT 1 FROM presencas 
         WHERE user_id = $1 
         AND guild_id = $2 
         AND data::date = $3`,
        [userId, guildId, hoje]
      );

      if (check.rows.length > 0) {
        return interaction.reply({
          content: '⚠️ Você já marcou presença hoje!',
          ephemeral: true
        });
      }

      // 💾 salva presença
      await db.query(
        `INSERT INTO presencas (user_id, username, guild_id, data)
         VALUES ($1, $2, $3, NOW())`,
        [userId, username, guildId]
      );

      // 📊 total do usuário
      const total = await db.query(
        `SELECT COUNT(*) as total 
         FROM presencas 
         WHERE user_id = $1 AND guild_id = $2`,
        [userId, guildId]
      );

      const totalPresencas = total.rows[0].total;

      // 🎨 embed bonito
      const embed = new EmbedBuilder()
        .setTitle('✅ Presença Registrada')
        .setDescription(`Bem-vindo, **${username}**!`)
        .addFields(
          { name: '📅 Hoje', value: 'Presença confirmada', inline: true },
          { name: '📊 Total', value: String(totalPresencas), inline: true }
        )
        .setColor('#5865F2')
        .setFooter({ text: 'Sistema SaaS Escolar' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error(error);

      interaction.reply({
        content: '❌ Erro ao registrar presença.',
        ephemeral: true
      });
    }
  }
});

client.login(process.env.TOKEN || process.env.DISCORD_TOKEN);