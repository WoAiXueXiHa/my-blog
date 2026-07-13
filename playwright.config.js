const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:1313' },
  webServer: {
    command: 'hugo server --bind 127.0.0.1 --port 1313 --disableFastRender',
    url: 'http://127.0.0.1:1313',
    reuseExistingServer: false,
  },
});
