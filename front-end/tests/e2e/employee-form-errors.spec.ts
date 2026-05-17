import { expect, test, type Page } from '@playwright/test';

const adminStatePath = 'playwright/.auth/admin.json';

test.describe('Admin employee form error handling', () => {
  test.use({ storageState: adminStatePath });

  test('shows validation error and stays on employees page for invalid data', async ({ page }) => {
    await page.goto('/admin/employees');
    await waitForEmployeesToLoad(page);

    await page.getByTestId('employee-add-btn').click();
    await page.getByTestId('employee-name-input').fill('E2E Invalid Employee');
    await page.getByTestId('employee-email-input').fill('not-an-email');
    await page.getByTestId('employee-department-select').selectOption('IT');
    await page.getByTestId('employee-dob-input').fill('1998-03-20');

    const responsePromise = page.waitForResponse((response) => {
      return response.request().method() === 'POST'
        && response.url().includes('/api/staff')
        && response.status() >= 400;
    });

    await page.getByTestId('employee-create-submit').click();
    const response = await responsePromise;

    expect(response.status()).toBeGreaterThanOrEqual(400);
    await expect(page).toHaveURL(/\/admin\/employees/);
    await expect(page.getByTestId('employee-create-modal')).toBeVisible();
    await expect(page.getByTestId('employee-error-msg')).toBeVisible();
    await expect(page.getByTestId('toast-success-msg')).toBeHidden();
  });
});

async function waitForEmployeesToLoad(page: Page) {
  const loadingState = page.getByTestId('employee-loading-state');

  if (await loadingState.isVisible().catch(() => false)) {
    await loadingState.waitFor({ state: 'detached' });
  }
}
