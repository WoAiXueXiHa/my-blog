const { randomBytes } = require('node:crypto');

module.exports = function auth(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  if (!process.env.OAUTH_GITHUB_CLIENT_ID || !process.env.OAUTH_REDIRECT_URI) {
    return res.status(503).send('GitHub OAuth is not configured.');
  }
  if (req.query.provider !== 'github') return res.status(400).send('Unsupported provider.');
  const site = new URL(process.env.OAUTH_REDIRECT_URI).hostname;
  if (req.query.site_id !== site) return res.status(400).send('Invalid site.');

  const state = randomBytes(32).toString('base64url');
  res.setHeader('Set-Cookie', `cms_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/api/callback`);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', process.env.OAUTH_GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', process.env.OAUTH_REDIRECT_URI);
  url.searchParams.set('scope', 'public_repo');
  url.searchParams.set('state', state);
  res.redirect(302, url.toString());
};
