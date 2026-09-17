const { test, expect } = require('@playwright/test');

async function openArticle(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await page.goto('/posts/ui-test-fixture/', {
        waitUntil: 'domcontentloaded', timeout: 10_000,
      });
      expect(response.ok()).toBe(true);
      return;
    } catch (error) {
      if (attempt === 2 || !/ERR_CONNECTION_RESET|ERR_ABORTED|Timeout/.test(String(error))) throw error;
    }
  }
}

for (const width of [390, 639, 640, 768, 900, 1024, 1440, 2160]) {
  test(`article columns stay aligned at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    // Third-party comments are unrelated to local layout and can stall deferred scripts.
    await page.route('https://giscus.app/**', route => route.abort());
    await openArticle(page);
    await expect(page.locator('.post-content')).toBeVisible();
    const measure = () => page.evaluate(() => {
      const box = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width };
      };
      return {
        header: box('.post-header'), content: box('.post-content'),
        footer: box('.post-footer'), first: box('.post-content > :first-child'),
        toc: box('.toc-sidebar'), overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    const layout = await measure();
    expect(Math.abs(layout.header.left - layout.content.left)).toBeLessThan(1);
    expect(Math.abs(layout.footer.left - layout.content.left)).toBeLessThan(1);
    expect(Math.abs(layout.first.top - layout.content.top)).toBeLessThan(1);
    expect(layout.overflow).toBe(false);
    const picture = page.locator('.post-content img').first();
    await picture.scrollIntoViewIfNeeded();
    await expect.poll(() => picture.evaluate(img => img.complete && img.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
    const bounds = await picture.evaluate(img => {
      const rect = img.getBoundingClientRect();
      const content = img.closest('.post-content').getBoundingClientRect();
      return { right: rect.right, contentRight: content.right, left: rect.left, contentLeft: content.left };
    });
    expect(bounds.right).toBeLessThanOrEqual(bounds.contentRight + 1);
    expect(bounds.left).toBeGreaterThanOrEqual(bounds.contentLeft - 1);

    if (width >= 640) {
      expect(Math.abs(layout.toc.top - layout.first.top)).toBeLessThan(1);
      await page.getByRole('button', { name: '收起目录', exact: true }).click();
      await expect(page.locator('.toc-nav')).toBeHidden();
      await page.getByRole('button', { name: '展开目录', exact: true }).click();
      await expect(page.locator('.toc-nav')).toBeVisible();
      const expanded = await measure();
      expect(expanded.content.left).toBe(layout.content.left);
      expect(expanded.content.width).toBe(layout.content.width);
    }
  });
}

test('collapsed desktop navigation remains usable across mobile resizing', async ({ page }) => {
  await page.route('https://giscus.app/**', route => route.abort());
  await page.setViewportSize({ width: 1024, height: 900 });
  await openArticle(page);
  await page.getByRole('button', { name: '收起目录', exact: true }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.toc-nav')).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.toc-drawer-trigger').click();
  await expect(page.locator('.toc-nav')).toBeVisible();
  await page.getByRole('button', { name: '关闭目录', exact: true }).click();
  await expect(page.locator('#toc-sidebar')).toHaveAttribute('aria-hidden', 'true');
  await page.locator('.toc-drawer-trigger').click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator('body')).not.toHaveClass(/toc-drawer-open/);
  await expect(page.locator('.toc-backdrop')).toBeHidden();
  await page.getByRole('button', { name: '展开目录', exact: true }).click();
  await expect(page.locator('.toc-nav')).toBeVisible();
});
