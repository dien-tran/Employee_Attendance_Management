import { expect, test } from '@playwright/test';

const adminStatePath = 'playwright/.auth/admin.json';
const userStatePath = 'playwright/.auth/user.json';

test.describe('Guest guard and root redirect', () => {
  test.describe('admin session', () => {
    test.use({ storageState: adminStatePath });

    for (const path of ['/admin/login', '/login', '/user/login', '/']) {
      test(`redirects ${path} to the admin home`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByTestId('login-form-auth')).toBeHidden();
        await expect(page).toHaveURL(/\/admin\/employees/);
        await expect(page.getByTestId('admin-sidebar')).toBeVisible();
      });
    }
  });

  test.describe('user session', () => {
    test.use({ storageState: userStatePath });

    for (const path of ['/admin/login', '/login', '/user/login', '/']) {
      test(`redirects ${path} to the user home`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByTestId('login-form-auth')).toBeHidden();
        await expect(page).toHaveURL(/\/user\/home/);
        await expect(page.getByTestId('user-sidebar')).toBeVisible();
      });
    }
  });

  test.describe('cross-login from user form', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('sends an admin who signs in on the user form to the admin portal', async ({ page }) => {
      await page.goto('/login');
      await page.getByTestId('login-email-input').fill(process.env.E2E_ADMIN_EMAIL!);
      await page.getByTestId('login-password-input').fill(process.env.E2E_ADMIN_PASSWORD!);

      const loginResponse = page.waitForResponse((response) => {
        return response.url().includes('/api/auth/login') && response.status() === 200;
      });

      await page.getByTestId('login-submit-btn').click();
      await loginResponse;

      await expect(page).toHaveURL(/\/admin\/(dashboard|employees)/);
      await expect(page.getByTestId('admin-sidebar')).toBeVisible();
      await expect(page.getByTestId('login-form-auth')).toBeHidden();
    });
  });
});
