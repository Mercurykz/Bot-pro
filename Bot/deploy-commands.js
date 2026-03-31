const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('presenca')
    .setDescription('Registrar presença'),
  new SlashCommandBuilder()
    .setName('chamada')
    .setDescription('Abrir o sistema atual de chamada')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN || process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registrando comandos...');

    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log(`Comandos registrados na guild ${process.env.GUILD_ID}!`);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log('Comandos globais registrados! (podem demorar para aparecer)');
    }
  } catch (err) {
    console.error(err);
  }
})();
