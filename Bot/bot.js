require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');
const db = require('./database');

console.log('🚀 Iniciando bot Discord...');

const BOT_TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ TOKEN/DISCORD_TOKEN não configurado. O bot não pode iniciar.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL não configurado. O comando /presenca pode falhar.');
}

// 🔥 cria cliente
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// 🧠 cooldown em memória
const cooldown = new Map();

function getSlashCommands() {
  return [
    new SlashCommandBuilder()
      .setName('presenca')
      .setDescription('Registrar presença'),
    new SlashCommandBuilder()
      .setName('chamada')
      .setDescription('Abrir o sistema atual de chamada')
  ].map(cmd => cmd.toJSON());
}

async function syncSlashCommands(client) {
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  const commands = getSlashCommands();
  const appId = process.env.CLIENT_ID || client.user?.id;

  if (!appId) {
    console.warn('⚠️ CLIENT_ID não encontrado; não foi possível sincronizar slash commands.');
    return;
  }

  try {
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(appId, process.env.GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Slash commands sincronizados na guild ${process.env.GUILD_ID}.`);
    } else {
      await rest.put(
        Routes.applicationCommands(appId),
        { body: commands }
      );
      console.log('✅ Slash commands globais sincronizados (pode levar alguns minutos para aparecer).');
    }
  } catch (err) {
    console.error('❌ Erro ao sincronizar slash commands:', err);
  }
}

client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot logado como ${client.user.tag}`);
  syncSlashCommands(client);
});

client.on('error', (error) => {
  console.error('❌ Erro no cliente Discord:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
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
      .setFooter({ text: 'Mercury Class' })
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

      // 💾 busca mapeamento para nome real
      const mappingRes = await db.query(
        `SELECT real_name FROM discord_mappings WHERE discord_username = $1`,
        [username]
      );

      let mappedName = username;
      let activeSessionMsg = '';

      if (mappingRes.rowCount > 0) {
        mappedName = mappingRes.rows[0].real_name;
        
        // Verifica se existe sessão de aula ativa no momento
        try {
          // 1. Tenta buscar sessões ativas onde o aluno está matriculado
          let activeSession = await db.query(
            `SELECT cs.id, cs.class_id, c.name AS class_name
             FROM class_sessions cs
             JOIN classes c ON c.id = cs.class_id
             JOIN enrollments e ON e.class_id = c.id
             JOIN users u ON u.id = e.student_id
             WHERE cs.active = true 
               AND (LOWER(u.username) = LOWER($1) OR LOWER(u.id) = LOWER($1))
             ORDER BY cs.start_time DESC
             LIMIT 1`,
            [mappedName]
          );

          // 2. Se não achou por matrícula, busca qualquer sessão ativa recente como fallback
          if (activeSession.rowCount === 0) {
            activeSession = await db.query(
              `SELECT cs.id, cs.class_id, c.name AS class_name
               FROM class_sessions cs
               JOIN classes c ON c.id = cs.class_id
               WHERE cs.active = true
               ORDER BY cs.start_time DESC
               LIMIT 1`
            );
          }

          if (activeSession.rowCount > 0) {
            const sessionId = activeSession.rows[0].id;
            const classId = activeSession.rows[0].class_id;
            const className = activeSession.rows[0].class_name;
            
            // Verifica se o aluno já tem presença nesta sessão
            const checkAtt = await db.query(
              `SELECT 1 FROM attendances WHERE class_session_id = $1 AND student_name = $2`,
              [sessionId, mappedName]
            );
            if (checkAtt.rowCount === 0) {
              await db.query(
                `INSERT INTO attendances (class_session_id, class_id, student_name, login_at) VALUES ($1, $2, $3, NOW())`,
                [sessionId, classId, mappedName]
              );
              activeSessionMsg = `\n📖 **Chamada Escolar:** Registrado como **${mappedName}** na aula ativa de **${className}**!`;
            } else {
              activeSessionMsg = `\n📖 **Chamada Escolar:** Você já tem presença registrada na aula ativa de **${className}**.`;
            }
          }
        } catch (sessErr) {
          console.error('Erro ao registrar presença em chamada ativa via Discord:', sessErr);
        }
      }

      // 💾 salva presença geral na tabela Discord
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
        .setDescription(`Bem-vindo, **${mappedName}**!${activeSessionMsg}`)
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

client.login(BOT_TOKEN);