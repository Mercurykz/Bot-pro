const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const db = require('./database');

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL,
  scope: ['identify', 'guilds']
},
(accessToken, refreshToken, profile, done) => {
  process.nextTick(async () => {
    try {
      // garante registro de usuário no DB com role
      await db.query(
        `INSERT INTO users (id, username, role) VALUES ($1, $2, 'aluno')
         ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username`,
        [profile.id, profile.username]
      );

      const result = await db.query(`SELECT role FROM users WHERE id = $1`, [profile.id]);
      const role = result.rows[0]?.role || 'aluno';

      done(null, { ...profile, role });
    } catch (error) {
      done(error);
    }
  });
}));

module.exports = passport;
