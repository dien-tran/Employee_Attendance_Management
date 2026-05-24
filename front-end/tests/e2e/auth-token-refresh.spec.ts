import { expect, test } from '@playwright/test';
import {
  expectProtectedApiStatus,
  expectSameSession,
  getAccessTokenSetCookie,
  loginViaApi,
  refreshAccessToken,
  type TestRole,
} from './helpers/auth-token';

for (const role of ['admin', 'user'] as TestRole[]) {
  test.describe(`Auth refresh happy path - ${role}`, () => {
    test('rotates access token and preserves protected access', async () => {
      const session = await loginViaApi(role);

      try {
        const refreshed = await refreshAccessToken(session.context);

        expect(refreshed.response.status()).toBe(200);
        expect(refreshed.token).toBeTruthy();
        expect(refreshed.token).not.toBe(session.token);
        expect(refreshed.jwt?.jti).not.toBe(session.payload.jti);
        expect(getAccessTokenSetCookie(refreshed.response)).toContain('access_token=');

        expectSameSession(session.payload, refreshed.jwt!);
        await expectProtectedApiStatus(role, refreshed.token!, 200);
      } finally {
        await session.context.dispose();
      }
    });
  });
}
