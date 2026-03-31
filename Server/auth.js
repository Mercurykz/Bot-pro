const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const db = require('./database');

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL,
  scope: ['identify', 'guilds', 'guilds.members.read'],
  state: true
},
(accessToken, refreshToken, profile, done) => {
  process.nextTick(async () => {
    try {
      console.log('🔐 Discord auth initiated for user:', profile.username, 'ID:', profile.id);
      
      // Buscar cargos do usuário na guilda específica usando token do bot (endpoint de guild member)
      const guildId = process.env.GUILD_ID;
      const botToken = process.env.BOT_TOKEN;

      if (!botToken) {
        console.error('⚠️ BOT_TOKEN não definido no .env');
        return done(null, { ...profile, role: 'aluno' });
      }

      const response = await fetch(`https://discord.com/api/guilds/${guildId}/members/${profile.id}`, {
        headers: {
          Authorization: `Bot ${botToken}`
        }
      });

      if (!response.ok) {
        console.error('⚠️ Erro ao buscar membro da guilda:', response.status, response.statusText);
        return done(null, { ...profile, role: 'aluno' }); // fallback
      }

      const memberData = await response.json();
      const roles = memberData.roles || [];

      // Definir role baseado nos cargos
      const professorRoleId = process.env.PROFESSOR_ROLE_ID;
      const alunoRoleId = process.env.ALUNO_ROLE_ID;

      let role = 'aluno'; // default
      if (roles.includes(professorRoleId)) {
        role = 'professor';
      } else if (roles.includes(alunoRoleId)) {
        role = 'aluno';
      }

      console.log('✅ User role assigned:', role);

      // Atualizar ou inserir no DB
      if (db) {
        await db.query(
          `INSERT INTO users (id, username, role) VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, role = EXCLUDED.role`,
          [profile.id, profile.username, role]
        );
      }

      done(null, { ...profile, role });
    } catch (error) {
      console.error('❌ Erro no auth:', error.message);
      done(error);
    }
  });
}));

module.exports = passport;
