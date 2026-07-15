const { test, expect } = require('@playwright/test');

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }]) {
  test(`article renders at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('/posts/go-string/');
    await expect(page.locator('.post-content .katex')).not.toHaveCount(0);
    await expect(page.locator('.toc-nav')).not.toContainText('$O(1)$');
    const highlightedBlocks = page.locator('.post-content .highlight');
    const highlightedCount = await highlightedBlocks.count();
    for (let index = 0; index < highlightedCount; index += 1) {
      await expect(highlightedBlocks.nth(index).locator(':scope > .copy-code')).toHaveCount(1);
      await expect(highlightedBlocks.nth(index).locator('.lntd:first-child .copy-code')).toHaveCount(0);
    }
    expect(await page.locator('.post-content h2').first().evaluate(element => getComputedStyle(element, '::before').content)).toBe('none');
    const tocLayout = await page.locator('.toc-sidebar').evaluate(element => ({
      position: getComputedStyle(element).position,
      trigger: getComputedStyle(document.querySelector('.toc-drawer-trigger')).display,
    }));
    if (viewport.width >= 640) {
      expect(tocLayout).toEqual({ position: 'sticky', trigger: 'none' });
    } else {
      expect(tocLayout.position).toBe('fixed');
      expect(tocLayout.trigger).toBe('flex');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('markdown tables use a complete grid without styling code line tables', async ({ page }) => {
  await page.goto('/posts/go-string/');
  const borders = await page.locator('.post-content table:not(.lntable):has(th)').first().evaluate(table => {
    const header = table.querySelector('th');
    const cell = table.querySelector('td');
    return {
      headerRight: getComputedStyle(header).borderRightStyle,
      headerBottom: getComputedStyle(header).borderBottomStyle,
      cellRight: getComputedStyle(cell).borderRightStyle,
      cellBottom: getComputedStyle(cell).borderBottomStyle,
      codeTable: getComputedStyle(document.querySelector('.lntable')).borderTopStyle,
    };
  });
  expect(borders).toEqual({
    headerRight: 'solid',
    headerBottom: 'solid',
    cellRight: 'solid',
    cellBottom: 'solid',
    codeTable: 'none',
  });
});

test('global search shows suggestions and matches aliases and multiple terms', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-search-open]').first().click();
  await expect(page.locator('.vect-search-suggestions button').first()).toBeVisible();
  await page.locator('#vect-search-input').fill('字符串');
  await expect(page.locator('.vect-search-results')).toContainText('Go 中的字符串');
  await page.locator('#vect-search-input').fill('Go 内存');
  await expect(page.locator('.vect-search-results [role="option"]')).not.toHaveCount(0);
});

test('search treats hostile input as text', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-search-open]').first().click();
  await page.locator('#vect-search-input').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('.vect-search-results img')).toHaveCount(0);
});

test('mermaid diagrams render instead of exposing source code', async ({ page }) => {
  await page.goto('/posts/heap/');
  await expect(page.locator('.vect-mermaid svg')).toHaveCount(2);
  await expect(page.locator('code.language-mermaid')).toHaveCount(0);
  for (const slug of ['heap', 'linked-list']) {
    await page.goto(`/posts/${slug}/`);
    const taxonomy = await page.locator('.vect-post-taxonomy span').allTextContents();
    const normalized = taxonomy.map(label => label.replace(/^#/, '').trim().toLocaleLowerCase());
    expect(new Set(normalized).size).toBe(normalized.length);
  }
});

test('topic directory and local search work', async ({ page }) => {
  await page.goto('/topics/');
  await expect(page.locator('[data-topic-item]')).not.toHaveCount(0);
  await page.locator('[data-topic-search]').fill('Go');
  await expect(page.locator('[data-topic-item]:visible')).not.toHaveCount(0);
  await page.goto('/topics/golang/');
  await expect(page.locator('.vect-topic-toc')).toBeVisible();
  await page.locator('[data-topic-search]').fill('字符串');
  await expect(page.locator('[data-topic-item]:visible')).toContainText('字符串');
});

test('about page renders the complete article and contacts', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('[data-full-article]')).toContainText('关于连接');
  await expect(page.locator('[data-full-article]')).toContainText('触点');
  await expect(page.getByRole('link', { name: /GitHub/ }).first()).toHaveAttribute('href', /github\.com\/WoAiXueXiHa/);
  await expect(page.getByRole('link', { name: /Email/ }).first()).toHaveAttribute('href', 'mailto:1760198676@qq.com');
});
