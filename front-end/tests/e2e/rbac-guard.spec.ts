import { expect, test, type Page } from '@playwright/test';

const adminStatePath = 'playwright/.auth/admin.json';
const userStatePath = 'playwright/.auth/user.json';

test.describe('RBAC guard for protected routes', () => {
  test.describe('user cannot view admin routes', () => {
    test.use({ storageState: userStatePath });

    for (const path of ['/admin/employees', '/admin/attendance', '/admin/dashboard']) {
      test(`redirects user from ${path} to user home`, async ({ page }) => {
        await page.goto(path);
        await assertNoAdminContentFlash(page);
        await expect(page).toHaveURL(/\/user\/home/);
        await expect(page.getByTestId('user-sidebar')).toBeVisible();
      });
    }
  });

  test.describe('admin cannot view user routes', () => {
    test.use({ storageState: adminStatePath });

    for (const path of ['/user/home', '/user/profile', '/user/attendance']) {
      test(`redirects admin from ${path} to admin employees`, async ({ page }) => {
        await page.goto(path);
        await assertNoUserContentFlash(page);
        await expect(page).toHaveURL(/\/admin\/employees/);
        await expect(page.getByTestId('admin-sidebar')).toBeVisible();
      });
    }
  });

  test.describe('anonymous user is sent to the matching login page', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('redirects anonymous admin route access to admin login', async ({ page }) => {
      await page.goto('/admin/employees');
      await expect(page).toHaveURL(/\/admin\/login/);
      await expect(page.getByTestId('login-form-auth')).toBeVisible();
      await expect(page.getByTestId('admin-sidebar')).toBeHidden();
    });

    test('redirects anonymous user route access to user login', async ({ page }) => {
      await page.goto('/user/home');
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByTestId('login-form-auth')).toBeVisible();
      await expect(page.getByTestId('user-sidebar')).toBeHidden();
    });
  });
});

async function assertNoAdminContentFlash(page: Page) {
  await expect(page.getByTestId('admin-sidebar')).toBeHidden();
  await expect(page.getByRole('heading', { name: /^(Employees|Admin Dashboard|Attendance)$/i })).toBeHidden();
}

async function assertNoUserContentFlash(page: Page) {
  await expect(page.getByTestId('user-sidebar')).toBeHidden();
  await expect(page.getByRole('heading', { name: /^(Welcome back, .*!|Profile|Attendance)$/i })).toBeHidden();
}
