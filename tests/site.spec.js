const { test, expect } = require('@playwright/test');

const ARTICLE_FIXTURE = '/posts/go-slice/';
const TABLE_FIXTURE = '/posts/mysql-transaction/';
const CRUD_FIXTURE = '/posts/mysql-crud/';

const gotoHealthy = async (page, path) => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 10_000 });
      expect(response, `No response received for ${path}`).not.toBeNull();
      expect(response.ok(), `${path} returned HTTP ${response.status()}`).toBe(true);
      return;
    } catch (error) {
      lastError = error;
      if (!/ERR_CONNECTION_RESET|ERR_ABORTED|Timeout/.test(String(error)) || attempt === 2) break;
      await page.waitForTimeout(300);
    }
  }
  throw lastError;
};

const collectConsoleErrors = page => {
  const errors = [];
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.includes('Failed to load resource: net::ERR_CONNECTION_RESET')) return;
    errors.push(text);
  });
  page.on('pageerror', error => errors.push(error.message));
  return errors;
};

const waitForSiteReady = async page => {
  await page.locator('html[data-vect-ready="true"]').waitFor();
};

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1440, height: 900 }]) {
  test(`article renders at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = collectConsoleErrors(page);
    await gotoHealthy(page, ARTICLE_FIXTURE);
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
  await gotoHealthy(page, TABLE_FIXTURE);
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

test('mysql crud article renders group by code fence as SQL', async ({ page }) => {
  await gotoHealthy(page, CRUD_FIXTURE);
  const content = page.locator('.post-content');
  await expect(content).not.toContainText(String.fromCharCode(96).repeat(3));
  const groupByBlock = page.locator('.post-content pre code.language-sql').filter({ hasText: 'group by class_name' });
  await expect(groupByBlock).toHaveCount(1);
  await expect(groupByBlock).toContainText('having avg(score) > 80');
});

test('global search shows suggestions and matches aliases and multiple terms', async ({ page }) => {
  await gotoHealthy(page, '/');
  await waitForSiteReady(page);
  await page.locator('[data-search-open]').first().click();
  await expect(page.locator('.vect-search-suggestions button').first()).toBeVisible();
  await page.locator('#vect-search-input').fill('slice');
  await expect(page.locator(`.vect-search-results a[href="${ARTICLE_FIXTURE}"]`)).toBeVisible();
  await page.locator('#vect-search-input').fill('Go 内存');
  await expect(page.locator('.vect-search-results [role="option"]')).not.toHaveCount(0);
});

test('search page uses the custom search experience', async ({ page }) => {
  await gotoHealthy(page, '/search/');
  await waitForSiteReady(page);
  await expect(page.locator('[data-vect-search-page]')).toBeVisible();
  await expect(page.locator('#searchbox')).toHaveCount(0);
  await expect(page.locator('[data-search-page-suggestions] button').first()).toBeVisible();
  await page.locator('[data-search-page-input]').fill('slice');
  await expect(page.locator(`[data-search-page-results] a[href="${ARTICLE_FIXTURE}"]`)).toBeVisible();
});

test('search treats hostile input as text', async ({ page }) => {
  await gotoHealthy(page, '/');
  await waitForSiteReady(page);
  await page.locator('[data-search-open]').first().click();
  await page.locator('#vect-search-input').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('.vect-search-results img')).toHaveCount(0);
});

test('navigation and search tolerate blocked localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  const errors = collectConsoleErrors(page);
  await gotoHealthy(page, ARTICLE_FIXTURE);
  await waitForSiteReady(page);
  await page.locator('[data-search-open]').first().click();
  await expect(page.locator('.vect-search-suggestions button').first()).toBeVisible();
  await page.locator('#vect-search-input').fill('slice');
  await expect(page.locator(`.vect-search-results a[href="${ARTICLE_FIXTURE}"]`)).toBeVisible();
  expect(errors).toEqual([]);
});

test('mermaid diagrams render instead of exposing source code', async ({ page }) => {
  await gotoHealthy(page, '/posts/heap/');
  await expect(page.locator('.vect-mermaid svg')).toHaveCount(2);
  await expect(page.locator('code.language-mermaid')).toHaveCount(0);
  for (const slug of ['heap', 'linked-list']) {
    await gotoHealthy(page, `/posts/${slug}/`);
    const taxonomy = await page.locator('.vect-post-taxonomy span').allTextContents();
    const normalized = taxonomy.map(label => label.replace(/^#/, '').trim().toLocaleLowerCase());
    expect(new Set(normalized).size).toBe(normalized.length);
  }
});

test('topic directory and local search work', async ({ page }) => {
  await gotoHealthy(page, '/topics/');
  await expect(page.locator('[data-topic-item]')).not.toHaveCount(0);
  await page.locator('[data-topic-search]').fill('Go');
  await expect(page.locator('[data-topic-item]:visible')).not.toHaveCount(0);
  await gotoHealthy(page, '/topics/golang/');
  await expect(page.locator('.vect-topic-toc')).toBeVisible();
  await page.locator('[data-topic-search]').fill('切片');
  const searchResults = page.locator('[data-topic-item]:visible');
  await expect(searchResults).not.toHaveCount(0);
  await expect(searchResults.filter({ hasText: '切片' })).not.toHaveCount(0);
});

test('about page renders the complete article and contacts', async ({ page }) => {
  await gotoHealthy(page, '/about/');
  await expect(page.locator('[data-full-article]')).toContainText('关于连接');
  await expect(page.locator('[data-full-article]')).toContainText('触点');
  await expect(page.getByRole('link', { name: /GitHub/ }).first()).toHaveAttribute('href', /github\.com\/WoAiXueXiHa/);
  await expect(page.getByRole('link', { name: /Email/ }).first()).toHaveAttribute('href', 'mailto:1760198676@qq.com');
});
