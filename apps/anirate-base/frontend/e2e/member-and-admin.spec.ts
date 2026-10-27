// What members and admins do: rate both versions, report a dub, see My ratings,
// and key a requested title into the catalogue.
import { expect, test } from '@playwright/test';
import { ADMIN, createTitle, deleteTitle, DEMO, signIn, uniqueName } from './helpers';

test.describe('member', () => {
  let titleId: string;
  const title = uniqueName('Member Title');

  test.beforeAll(async ({ request }) => {
    titleId = await createTitle(request, title);
  });

  test.afterAll(async ({ request }) => {
    await deleteTitle(request, titleId);
  });

  test('rates the sub and the dub, which also reports the dub, and finds it in My ratings', async ({ page }) => {
    await signIn(page, DEMO);
    await page.goto(`/anime/${titleId}`);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    await page.getByRole('button', { name: 'Sub 4 of 5' }).click();
    await expect(page.locator('.rate__status--ok')).toBeVisible();
    await page.getByRole('button', { name: 'Dub 5 of 5' }).click();
    await expect(page.getByText(/You reported an English dub/)).toBeVisible();

    await page.goto('/my-ratings');
    await expect(page.locator('a.entry', { hasText: title })).toBeVisible();

    // Leave the shared account as it was.
    await page.goto(`/anime/${titleId}`);
    await page.getByRole('button', { name: 'Clear my ratings' }).click();
    await expect(page.getByText('Your ratings for this work were cleared.')).toBeVisible();
    await page.getByRole('button', { name: 'Take back my report' }).click();
  });
});

test.describe('admin', () => {
  test('keys a requested title into the catalogue', async ({ page, request }) => {
    const requested = uniqueName('Requested Show');
    await page.goto('/request?title=' + encodeURIComponent(requested));
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText(/is in the queue for review/)).toBeVisible();

    await signIn(page, ADMIN);
    await page.goto('/admin');
    const row = page.locator('.admin__row', { hasText: requested });
    await row.getByRole('button', { name: 'Add to catalogue' }).click();
    await page.locator('.admin__form textarea').first().fill('E2E Other Name');
    await page.getByRole('button', { name: 'Add to the catalogue' }).click();
    await expect(row).toHaveCount(0);

    await page.getByRole('button', { name: 'Added', exact: true }).click();
    const added = page.locator('.admin__row', { hasText: requested });
    const href = await added.getByRole('link', { name: 'View the added title' }).getAttribute('href');
    const id = String(href).split('/anime/')[1];

    await page.goto(`/anime/${id}`);
    await expect(page.locator('h1#work-title')).toHaveText(requested);
    await deleteTitle(request, id);
  });

  test('the admin room is closed to members', async ({ page }) => {
    await signIn(page, DEMO);
    await page.goto('/admin');
    await expect(page.getByText('This room is for admins.')).toBeVisible();
  });
});
