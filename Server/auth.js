const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const db = require('./database');

function resolveCallbackUrl() {
  const fromEnv = (process.env.CALLBACK_URL || process.env.DISCORD_CALLBACK_URL || '').trim();
  if (fromEnv) return fromEnv;

  const appUrl = (process.env.APP_URL || '').trim().replace(/\/$/, '');
  if (appUrl) return `${appUrl}/callback`;

  const railwayDomain = (process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
  if (railwayDomain) return `https://${railwayDomain}/callback`;

  return null;
}

const callbackURL = resolveCallbackUrl();
if (!callbackURL) {
  console.error('⚠️ CALLBACK_URL não definido. Defina CALLBACK_URL ou APP_URL no ambiente.');
} else {
  console.log('🔗 OAuth callbackURL em uso:', callbackURL);
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL,
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
      const adminRoleId = (process.env.ADMIN_ROLE_ID || '').trim();
      const professorRoleId = (process.env.PROFESSOR_ROLE_ID || '').trim();
      const alunoRoleId = (process.env.ALUNO_ROLE_ID || '').trim();

      console.log('🔍 Discord roles for user:', roles);
      console.log('🔍 ADMIN_ROLE_ID:', adminRoleId, 'PROFESSOR_ROLE_ID:', professorRoleId, 'ALUNO_ROLE_ID:', alunoRoleId);

      let role = 'aluno'; // default
      if (adminRoleId && roles.includes(adminRoleId)) {
        role = 'admin';
      } else if (professorRoleId && roles.includes(professorRoleId)) {
        role = 'professor';
      } else if (alunoRoleId && roles.includes(alunoRoleId)) {
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
