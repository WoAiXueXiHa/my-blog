const { randomInt } = require('node:crypto');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { defineConfig } = require('@playwright/test');

const runDirectory = process.env.VECT_PLAYWRIGHT_RUN_DIRECTORY || mkdtempSync(join(tmpdir(), 'my-blog-playwright-'));
process.env.VECT_PLAYWRIGHT_RUN_DIRECTORY = runDirectory;
const siteDirectory = join(runDirectory, 'site');
const port = Number(process.env.VECT_PLAYWRIGHT_PORT || randomInt(20_000, 60_000));
process.env.VECT_PLAYWRIGHT_PORT = String(port);
const baseURL = `http://127.0.0.1:${port}`;
const shellQuote = value => `'${value.replaceAll("'", "'\"'\"'")}'`;

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  workers: 1,
  outputDir: join(runDirectory, 'results'),
  reporter: [
    ['list'],
    ['html', { outputFolder: join(runDirectory, 'report'), open: 'never' }],
  ],
  use: { baseURL },
  webServer: {
    command: `hugo --config hugo.toml,tests/hugo.test.toml --gc --minify --cleanDestinationDir --destination ${shellQuote(siteDirectory)} && python3 -m http.server ${port} --bind 127.0.0.1 --directory ${shellQuote(siteDirectory)}`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
