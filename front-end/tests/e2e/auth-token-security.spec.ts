import { expect, test } from '@playwright/test';
import {
  expectProtectedApiStatus,
  getAccessTokenSetCookie,
  loginViaApi,
  logoutAccessToken,
  refreshAccessToken,
  type TestRole,
} from './helpers/auth-token';

for (const role of ['admin', 'user'] as TestRole[]) {
  test.describe(`Auth refresh blacklist and logout - ${role}`, () => {
    test('blacklists old token after refresh and current token after logout', async ({ page }) => {
      const session = await loginViaApi(role);

      try {
        const refreshed = await refreshAccessToken(session.context);
        expect(refreshed.response.status()).toBe(200);

        await expectProtectedApiStatus(role, session.token, 401);
        await expectProtectedApiStatus(role, refreshed.token!, 200);

        const logoutResponse = await logoutAccessToken(session.context);
        expect(logoutResponse.status()).toBe(200);
        expect(getAccessTokenSetCookie(logoutResponse)).toMatch(/access_token=;/);
        await expectProtectedApiStatus(role, refreshed.token!, 401);

        await page.goto(role === 'admin' ? '/admin/employees' : '/user/profile');
        await expect(page).toHaveURL(role === 'admin' ? /\/admin\/login/ : /\/login/);
        await expect(page.getByTestId('login-form-auth')).toBeVisible();
      } finally {
        await session.context.dispose();
      }
    });
  });
}
