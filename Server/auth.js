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
      
      let role = 'aluno'; // default

      // Tentar buscar cargos do usuário na guilda específica
      const guildId = process.env.GUILD_ID;
      const botToken = process.env.BOT_TOKEN;

      if (botToken) {
        try {
          const response = await fetch(`https://discord.com/api/guilds/${guildId}/members/${profile.id}`, {
            headers: { Authorization: `Bot ${botToken}` }
          });

          if (response.ok) {
            const memberData = await response.json();
            const roles = memberData.roles || [];

            const adminRoleId = (process.env.ADMIN_ROLE_ID || '').trim();
            const professorRoleId = (process.env.PROFESSOR_ROLE_ID || '').trim();
            const alunoRoleId = (process.env.ALUNO_ROLE_ID || '').trim();

            const isGuildOwnerOrAdmin = (profile.guilds || []).some(g => g.id === guildId && (g.owner === true || (g.permissions & 0x8) === 0x8));
            
            if (profile.id === '329759368383856641' || isGuildOwnerOrAdmin) {
              role = 'admin';
            } else if (adminRoleId && roles.includes(adminRoleId)) {
              role = 'admin';
            } else if (professorRoleId && roles.includes(professorRoleId)) {
              role = 'professor';
            } else if (alunoRoleId && roles.includes(alunoRoleId)) {
              role = 'aluno';
            }
          } else {
            console.error('⚠️ Erro ao buscar membro da guilda (Status):', response.status);
          }
        } catch (fetchErr) {
          console.error('⚠️ Exceção ao buscar cargos no Discord:', fetchErr.message);
        }
      } else {
        console.error('⚠️ BOT_TOKEN não definido no .env');
      }

      console.log('✅ User role assigned:', role);

      // Atualizar ou inserir no DB SEMPRE
      if (db) {
        const existingUser = await db.query('SELECT role FROM users WHERE id = $1', [profile.id]);
        if (existingUser.rowCount > 0) {
          // Mantém o cargo que já está salvo no DB (para respeitar o painel de admins)
          role = existingUser.rows[0].role;
          await db.query(`UPDATE users SET username = $1 WHERE id = $2`, [profile.username, profile.id]);
        } else {
          // Insere novo usuário com o cargo (default ou puxado do Discord)
          await db.query(`INSERT INTO users (id, username, role) VALUES ($1, $2, $3)`, [profile.id, profile.username, role]);
        }
      }

      done(null, { ...profile, role });
    } catch (error) {
      console.error('❌ Erro no auth:', error.message);
      done(error);
    }
  });
}));

module.exports = passport;
