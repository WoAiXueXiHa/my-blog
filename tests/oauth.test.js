const test = require('node:test');
const assert = require('node:assert/strict');
const auth = require('../api/auth');
const callback = require('../api/callback');

function response() {
  return {
    headers: {}, statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    send(value) { this.body = value; return this; },
    end() { return this; },
    redirect(code, location) { this.statusCode = code; this.location = location; return this; },
  };
}

const env = {
  OAUTH_GITHUB_CLIENT_ID: 'test-client',
  OAUTH_GITHUB_CLIENT_SECRET: 'test-secret',
  OAUTH_REDIRECT_URI: 'https://blog.example/api/callback',
};

test('login creates state cookie and asks only for public repository access', () => {
  Object.assign(process.env, env);
  const res = response();
  auth({ method: 'GET', query: { provider: 'github', site_id: 'blog.example' } }, res);
  const url = new URL(res.location);
  assert.equal(res.statusCode, 302);
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.searchParams.get('scope'), 'public_repo');
  assert.match(res.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(url.searchParams.get('state'), res.headers['Set-Cookie'].match(/cms_oauth_state=([^;]+)/)[1]);
});

test('callback rejects invalid state without exchanging a token', async () => {
  const previous = global.fetch;
  global.fetch = () => { throw new Error('unexpected network request'); };
  try {
    const res = response();
    await callback({ method: 'GET', headers: { cookie: 'cms_oauth_state=correct' }, query: { state: 'wrong', code: 'code' } }, res);
    assert.equal(res.statusCode, 302);
    assert.match(res.location, /oauth-callback\.html#/);
    assert.match(decodeURIComponent(res.location), /Invalid or expired login state/);
  } finally { global.fetch = previous; }
});

test('callback accepts only the owner account', async () => {
  Object.assign(process.env, env);
  const previous = global.fetch;
  global.fetch = async (url) => ({
    ok: true,
    json: async () => url.includes('access_token') ? { access_token: 'sample-token' } : { login: 'another-user' },
  });
  try {
    const res = response();
    await callback({ method: 'GET', headers: { cookie: 'cms_oauth_state=same' }, query: { state: 'same', code: 'code' } }, res);
    assert.match(decodeURIComponent(res.location), /cannot edit the blog/);
    assert.doesNotMatch(res.location, /sample-token/);
  } finally { global.fetch = previous; }
});

test('owner callback returns a token only to the local popup page', async () => {
  Object.assign(process.env, env);
  const previous = global.fetch;
  global.fetch = async (url) => ({
    ok: true,
    json: async () => url.includes('access_token') ? { access_token: 'sample-token' } : { login: 'WoAiXueXiHa' },
  });
  try {
    const res = response();
    await callback({ method: 'GET', headers: { cookie: 'cms_oauth_state=same' }, query: { state: 'same', code: 'code' } }, res);
    assert.equal(res.statusCode, 302);
    assert.equal(res.location.split('#')[0], '/admin/oauth-callback.html');
    assert.deepEqual(JSON.parse(decodeURIComponent(res.location.split('#')[1])), { token: 'sample-token', provider: 'github' });
    assert.match(res.headers['Set-Cookie'], /Max-Age=0/);
  } finally { global.fetch = previous; }
});

test('popup sends token only to the isolated editor origin after a matching handshake', () => {
  const { runInNewContext } = require('node:vm');
  const { readFileSync } = require('node:fs');
  const script = readFileSync(require('node:path').join(__dirname, '../static/admin/oauth-callback.js'), 'utf8');
  const sent = [];
  const listeners = new Map();
  const opener = { postMessage(message, origin) { sent.push({ message, origin }); } };
  const window = {
    opener,
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const token = encodeURIComponent(JSON.stringify({ token: 'sample-token' }));
  runInNewContext(script, {
    location: { hash: `#${token}`, pathname: '/admin/oauth-callback.html' },
    history: { replaceState() {} },
    window,
    document: { body: {} },
  });
  assert.deepEqual(sent[0], { message: 'authorizing:github', origin: 'https://woaixuexiha.github.io' });
  listeners.get('message')({ source: opener, origin: 'https://evil.example', data: 'authorizing:github' });
  assert.equal(sent.length, 1);
  listeners.get('message')({ source: opener, origin: 'https://woaixuexiha.github.io', data: 'authorizing:github' });
  assert.equal(sent.length, 2);
  assert.equal(sent[1].origin, 'https://woaixuexiha.github.io');
  assert.match(sent[1].message, /authorization:github:success:/);
});
