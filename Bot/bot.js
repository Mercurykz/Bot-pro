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
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
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

function getEmojiForClass(className) {
  const name = className.toLowerCase();
  if (name.includes('matematica') || name.includes('cálculo') || name.includes('calculo') || name.includes('math')) return '🧮';
  if (name.includes('fisica') || name.includes('física') || name.includes('phys')) return '⏳';
  if (name.includes('quimica') || name.includes('química') || name.includes('chem')) return '🧪';
  if (name.includes('biolo')) return '🧬';
  if (name.includes('program') || name.includes('web') || name.includes('comput') || name.includes('dev')) return '💻';
  if (name.includes('historia') || name.includes('história')) return '📜';
  if (name.includes('portugues') || name.includes('português') || name.includes('literatura') || name.includes('redacao')) return '📚';
  if (name.includes('geografia')) return '🗺️';
  if (name.includes('ingles') || name.includes('inglês') || name.includes('english')) return '🇬🇧';
  return '🏫';
}

client.on(Events.InteractionCreate, async (interaction) => {
  // 1. Modal Submit Handler
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'vincular_modal') {
      const realName = interaction.fields.getTextInputValue('real_name_input').trim();
      const username = interaction.user.username;

      try {
        await db.query(
          `INSERT INTO discord_mappings (discord_username, real_name)
           VALUES ($1, $2)
           ON CONFLICT (discord_username) DO UPDATE SET real_name = EXCLUDED.real_name`,
          [username, realName]
        );

        await interaction.reply({
          content: `✅ Conta vinculada com sucesso a **${realName}**!\nDigite o comando `/presenca` novamente para registrar sua presença.`,
          ephemeral: true
        });
      } catch (err) {
        console.error(err);
        await interaction.reply({
          content: '❌ Erro ao vincular sua conta.',
          ephemeral: true
        });
      }
    }
    return;
  }

  // 2. Button Handler
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('presenca_aula_')) {
      const parts = interaction.customId.split('_');
      const sessionId = parseInt(parts[2], 10);
      const classId = parseInt(parts[3], 10);

      const userId = interaction.user.id;
      const username = interaction.user.username;
      const guildId = interaction.guild?.id || 'guild_default';

      try {
        // Busca mapeamento
        const mappingRes = await db.query(
          `SELECT real_name FROM discord_mappings WHERE discord_username = $1`,
          [username]
        );
        if (mappingRes.rowCount === 0) {
          return interaction.reply({
            content: '⚠️ Sua conta ainda não está vinculada. Por favor, digite `/presenca` para vincular primeiro.',
            ephemeral: true
          });
        }

        const mappedName = mappingRes.rows[0].real_name;

        // Busca nome da sala
        const classRes = await db.query('SELECT name FROM classes WHERE id = $1', [classId]);
        const className = classRes.rowCount > 0 ? classRes.rows[0].name : 'Aula';

        // Registra presença na chamada oficial
        const checkAtt = await db.query(
          `SELECT 1 FROM attendances WHERE class_session_id = $1 AND student_name = $2`,
          [sessionId, mappedName]
        );
        if (checkAtt.rowCount === 0) {
          await db.query(
            `INSERT INTO attendances (class_session_id, class_id, student_name, login_at) VALUES ($1, $2, $3, NOW())`,
            [sessionId, classId, mappedName]
          );
        }

        // 💾 salva presença geral na tabela Discord
        await db.query(
          `INSERT INTO presencas (user_id, username, guild_id, data) VALUES ($1, $2, $3, NOW())`,
          [userId, username, guildId]
        );

        const total = await db.query(
          `SELECT COUNT(*) as total FROM presencas WHERE user_id = $1 AND guild_id = $2`,
          [userId, guildId]
        );
        const totalPresencas = total.rows[0].total;

        const embed = new EmbedBuilder()
          .setTitle('✅ Presença Confirmada!')
          .setDescription(`Olá, **${mappedName}**!\nSua presença foi registrada com sucesso na matéria: **${className}**!`)
          .addFields(
            { name: '📅 Matéria', value: className, inline: true },
            { name: '📊 Total no Discord', value: String(totalPresencas), inline: true }
          )
          .setColor('#10B981')
          .setFooter({ text: 'Mercury Class' })
          .setTimestamp();

        await interaction.update({
          embeds: [embed],
          components: [],
          ephemeral: true
        });
      } catch (error) {
        console.error('Erro ao clicar no botão de presença:', error);
        await interaction.reply({
          content: '❌ Erro ao registrar presença na matéria selecionada.',
          ephemeral: true
        });
      }
    } else if (interaction.commandName !== 'chamada') {
      // Allow other buttons like standard check-in links to proceed
    }
  }

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
      // 🔍 verifica se já marcou hoje no Discord
      const hoje = new Date().toISOString().split('T')[0];
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

      // CASO A: Aluno NÃO está vinculado ainda -> Exibe o MODAL do Discord
      if (mappingRes.rowCount === 0) {
        const modal = new ModalBuilder()
          .setCustomId('vincular_modal')
          .setTitle('👾 Vincular Conta | Mercury Class');

        const realNameInput = new TextInputBuilder()
          .setCustomId('real_name_input')
          .setLabel('Seu Nome Completo (como na chamada)')
          .setStyle(TextInputStyle.Short)
          .setMinLength(3)
          .setMaxLength(100)
          .setRequired(true)
          .setPlaceholder('Ex: Ygor Belarmino da silva');

        const firstRow = new ActionRowBuilder().addComponents(realNameInput);
        modal.addComponents(firstRow);

        await interaction.showModal(modal);
        return;
      }

      // CASO B: Aluno já vinculado
      const mappedName = mappingRes.rows[0].real_name;

      // Busca todas as sessões de aula ativas
      const activeSessions = await db.query(
        `SELECT cs.id, cs.class_id, c.name AS class_name
         FROM class_sessions cs
         JOIN classes c ON c.id = cs.class_id
         WHERE cs.active = true
         ORDER BY cs.start_time DESC`
      );

      // Sub-Caso 1: Nenhuma aula ativa
      if (activeSessions.rowCount === 0) {
        await db.query(
          `INSERT INTO presencas (user_id, username, guild_id, data) VALUES ($1, $2, $3, NOW())`,
          [userId, username, guildId]
        );

        const total = await db.query(
          `SELECT COUNT(*) as total FROM presencas WHERE user_id = $1 AND guild_id = $2`,
          [userId, guildId]
        );
        const totalPresencas = total.rows[0].total;

        const embed = new EmbedBuilder()
          .setTitle('✅ Presença Registrada')
          .setDescription(`Olá, **${mappedName}**!\nSua presença geral no Discord foi confirmada (nenhuma aula ativa no momento).`)
          .addFields(
            { name: '📅 Hoje', value: 'Confirmada', inline: true },
            { name: '📊 Total', value: String(totalPresencas), inline: true }
          )
          .setColor('#5865F2')
          .setFooter({ text: 'Mercury Class' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // Sub-Caso 2: Exatamente uma aula ativa -> registra presença automaticamente
      if (activeSessions.rowCount === 1) {
        const sessionId = activeSessions.rows[0].id;
        const classId = activeSessions.rows[0].class_id;
        const className = activeSessions.rows[0].class_name;

        // Registra presença na chamada oficial
        const checkAtt = await db.query(
          `SELECT 1 FROM attendances WHERE class_session_id = $1 AND student_name = $2`,
          [sessionId, mappedName]
        );
        if (checkAtt.rowCount === 0) {
          await db.query(
            `INSERT INTO attendances (class_session_id, class_id, student_name, login_at) VALUES ($1, $2, $3, NOW())`,
            [sessionId, classId, mappedName]
          );
        }

        // 💾 salva presença geral na tabela Discord
        await db.query(
          `INSERT INTO presencas (user_id, username, guild_id, data) VALUES ($1, $2, $3, NOW())`,
          [userId, username, guildId]
        );

        const total = await db.query(
          `SELECT COUNT(*) as total FROM presencas WHERE user_id = $1 AND guild_id = $2`,
          [userId, guildId]
        );
        const totalPresencas = total.rows[0].total;

        const embed = new EmbedBuilder()
          .setTitle('✅ Presença Registrada')
          .setDescription(`Olá, **${mappedName}**!\n📖 **Chamada Escolar:** Presença confirmada na aula ativa de **${className}**!`)
          .addFields(
            { name: '📅 Matéria', value: className, inline: true },
            { name: '📊 Total', value: String(totalPresencas), inline: true }
          )
          .setColor('#5865F2')
          .setFooter({ text: 'Mercury Class' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // Sub-Caso 3: Múltiplas aulas ativas -> gera botões interativos para escolha
      const embed = new EmbedBuilder()
        .setTitle('🏫 Escolha sua Aula')
        .setDescription(`Olá, **${mappedName}**!\nIdentificamos mais de uma aula ativa no momento. Clique no botão correspondente para registrar sua presença:`)
        .setColor('#5865F2')
        .setFooter({ text: 'Mercury Class' })
        .setTimestamp();

      const row = new ActionRowBuilder();
      activeSessions.rows.forEach(session => {
        const emoji = getEmojiForClass(session.class_name);
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`presenca_aula_${session.id}_${session.class_id}`)
            .setLabel(`${emoji} ${session.class_name}`)
            .setStyle(ButtonStyle.Primary)
        );
      });

      return interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });

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
