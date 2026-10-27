// Every page, public and signed-in, scanned against WCAG 2.1 AA with axe. A failure
// lists each rule broken and where, so it can be fixed before it ships.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, createTitle, deleteTitle, signIn, uniqueName } from './helpers';

async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const problems = results.violations.map(
    (violation) => `${violation.impact ?? 'unknown'} ${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).slice(0, 3).join(', ')}`,
  );
  expect(problems, `accessibility problems on ${label}`).toEqual([]);
}

test.describe('accessibility', () => {
  let titleId: string;

  test.beforeAll(async ({ request }) => {
    titleId = await createTitle(request, uniqueName('Accessible Title'));
  });

  test.afterAll(async ({ request }) => {
    await deleteTitle(request, titleId);
  });

  for (const [label, path] of [
    ['home', '/'],
    ['search', '/catalog/search?q=a'],
    ['request a title', '/request'],
    ['privacy', '/privacy'],
    ['terms', '/terms'],
    ['sign in', '/login'],
    ['join', '/register'],
    ['forgot password', '/forgot-password'],
  ] as const) {
    test(`${label} page`, async ({ page }) => {
      await page.goto(path);
      await expectAccessible(page, label);
    });
  }

  test('a title page', async ({ page }) => {
    await page.goto(`/anime/${titleId}`);
    await expect(page.locator('h1#work-title')).toBeVisible();
    await expectAccessible(page, 'title page');
  });

  test('signed-in pages and every admin tab', async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto('/my-ratings');
    await expect(page.locator('h1')).toHaveText('My ratings');
    await expectAccessible(page, 'my ratings');

    await page.goto('/admin');
    await expect(page.locator('.admin__stats')).toBeVisible();
    for (const tab of ['Requests', 'Dub reports', 'Notes', 'Titles', 'Members', 'Activity']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(page.locator('.admin__section h2').first()).toBeVisible();
      await expectAccessible(page, `admin: ${tab}`);
    }
  });
});
