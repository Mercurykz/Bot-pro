const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log('🤖 Bot online');
});

// SLASH COMMAND
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('pong');
  }
});

// PREFIX SYSTEM (BANCO 🔥)
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  db.get(
    `SELECT prefix FROM configs WHERE guild_id = ?`,
    [message.guild.id],
    (err, row) => {
      const prefix = row?.prefix || '!';

      if (!message.content.startsWith(prefix)) return;

      if (message.content === prefix + 'ping') {
        message.reply('pong (prefix)');
      }
    }
  );
});

client.login(process.env.TOKEN);

// REGISTRAR SLASH COMMANDS
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Responde com pong')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🔄 Registrando comandos...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Comandos registrados');
  } catch (error) {
    console.error(error);
  }
})();
