const { timingSafeEqual } = require('node:crypto');

const redirect = (res, payload) => {
  const target = `/admin/oauth-callback.html#${encodeURIComponent(JSON.stringify(payload))}`;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Set-Cookie', 'cms_oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/api/callback');
  res.redirect(302, target);
};
const same = (a, b) => {
  const left = Buffer.from(a || '');
  const right = Buffer.from(b || '');
  return left.length === right.length && timingSafeEqual(left, right);
};

module.exports = async function callback(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const cookie = req.headers.cookie?.match(/(?:^|;\s*)cms_oauth_state=([^;]+)/)?.[1];
  if (!cookie || !same(cookie, req.query.state)) return redirect(res, { error: 'Invalid or expired login state.' });
  if (req.query.error) return redirect(res, { error: 'GitHub login was denied.' });
  if (typeof req.query.code !== 'string' || !req.query.code) return redirect(res, { error: 'Missing authorization code.' });
  const { OAUTH_GITHUB_CLIENT_ID: client_id, OAUTH_GITHUB_CLIENT_SECRET: client_secret, OAUTH_REDIRECT_URI: redirect_uri } = process.env;
  if (!client_id || !client_secret || !redirect_uri) return redirect(res, { error: 'GitHub OAuth is not configured.' });

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id, client_secret, code: req.query.code, redirect_uri }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error('GitHub token exchange failed');
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'my-blog-cms' },
    });
    const user = await userResponse.json();
    if (!userResponse.ok || user.login?.toLowerCase() !== 'woaixuexiha') {
      return redirect(res, { error: 'This GitHub account cannot edit the blog.' });
    }
    return redirect(res, { token: tokenData.access_token, provider: 'github' });
  } catch (error) {
    console.error('GitHub OAuth callback failed:', error.message);
    return redirect(res, { error: 'GitHub login failed. Please retry.' });
  }
};
