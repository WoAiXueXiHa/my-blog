const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: { baseURL: 'http://127.0.0.1:1313' },
  webServer: {
    command: 'hugo --gc --minify --cleanDestinationDir && python3 -m http.server 1313 --bind 127.0.0.1 --directory public',
    url: 'http://127.0.0.1:1313',
    reuseExistingServer: true,
  },
});
