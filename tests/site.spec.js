const { test, expect } = require('@playwright/test');

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`article renders at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('/posts/go-string/');
    await expect(page.locator('.post-content .katex')).not.toHaveCount(0);
    await expect(page.locator('.toc-nav')).not.toContainText('$O(1)$');
    const firstCodeBlock = page.locator('.post-content pre').first();
    const firstCopyButton = firstCodeBlock.locator('.copy-code');
    await expect(firstCopyButton).toHaveCount(1);
    await firstCodeBlock.hover();
    await expect(firstCopyButton).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('search treats hostile input as text', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '打开搜索' }).click();
  await page.locator('#vect-search-input').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('.vect-search-results img')).toHaveCount(0);
});
