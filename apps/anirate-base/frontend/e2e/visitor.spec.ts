// What a visitor does without an account: browse, search, open a title, request one.
import { expect, test } from '@playwright/test';
import { createTitle, deleteTitle, uniqueName } from './helpers';

test.describe('visitor', () => {
  let titleId: string;
  const title = uniqueName('Visitor Title');

  test.beforeAll(async ({ request }) => {
    titleId = await createTitle(request, title, { alternativeTitles: ['E2E Romaji Name'] });
  });

  test.afterAll(async ({ request }) => {
    await deleteTitle(request, titleId);
  });

  test('the homepage opens on the collection, popular first', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero-title')).toContainText('Two versions.');
    await expect(page.locator('nav.tabs a[aria-current="page"]')).toHaveText('Popular');
    await expect(page.locator('a.entry').first()).toBeVisible();
  });

  test('search finds a title by another of its names and opens it', async ({ page }) => {
    await page.goto('/catalog/search?q=' + encodeURIComponent('E2E Romaji Name'));
    const entry = page.locator('a.entry', { hasText: title });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page.locator('h1#work-title')).toHaveText(title);
    await expect(page.getByRole('link', { name: 'Sign in to rate' })).toBeVisible();
  });

  test('a missing title can be requested from the empty search, without an account', async ({ page }) => {
    const missing = uniqueName('Missing Show');
    await page.goto('/catalog/search?q=' + encodeURIComponent(missing));
    await page.getByRole('link', { name: 'Request this title' }).click();
    await expect(page.locator('#request-title')).toHaveValue(missing);
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText(/is in the queue for review/)).toBeVisible();
  });

  test('the phone menu reaches the rankings and the request page', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByText('Menu', { exact: true }).click();
    await expect(page.locator('.menu__panel a')).toHaveText(['Collection', 'Rankings', 'Request a title']);
    await page.locator('.menu__panel a', { hasText: 'Request a title' }).click();
    await expect(page).toHaveURL(/\/request$/);
    await context.close();
  });

  test('search engines get robots.txt, a sitemap and page titles', async ({ page, request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toMatch(/Sitemap: \S+\/sitemap\/0\.xml/);
    expect((await request.get('/sitemap/0.xml')).ok()).toBeTruthy();
    await page.goto('/privacy');
    await expect(page).toHaveTitle('Privacy · AniRate');
  });
});
