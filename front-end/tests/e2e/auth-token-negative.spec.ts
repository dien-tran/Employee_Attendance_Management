import { expect, test } from '@playwright/test';
import {
  expectNoFreshAccessTokenCookie,
  expectProtectedApiStatus,
  loginViaApi,
  newApiContext,
  refreshAccessToken,
  logoutAccessToken,
} from './helpers/auth-token';

test.describe('Auth refresh negative cases', () => {
  test('rejects missing and malformed refresh token without issuing a cookie', async () => {
    const anonymous = await newApiContext();

    try {
      const missing = await anonymous.post('/api/auth/refresh');
      expect(missing.status()).not.toBe(200);
      expectNoFreshAccessTokenCookie(missing);

      const malformed = await anonymous.post('/api/auth/refresh', {
        data: { token: 'not-a-jwt' },
      });
      expect(malformed.status()).not.toBe(200);
      expectNoFreshAccessTokenCookie(malformed);
    } finally {
      await anonymous.dispose();
    }
  });

  test('rejects tokens already invalidated by refresh or logout', async () => {
    const session = await loginViaApi('user');

    try {
      const refreshed = await refreshAccessToken(session.context);
      expect(refreshed.response.status()).toBe(200);

      const oldTokenRefresh = await refreshAccessToken(session.context, session.token);
      expect(oldTokenRefresh.response.status()).not.toBe(200);
      expectNoFreshAccessTokenCookie(oldTokenRefresh.response);
      await expectProtectedApiStatus('user', session.token, 401);

      const logoutResponse = await logoutAccessToken(session.context);
      expect(logoutResponse.status()).toBe(200);

      const loggedOutRefresh = await refreshAccessToken(session.context, refreshed.token);
      expect(loggedOutRefresh.response.status()).not.toBe(200);
      expectNoFreshAccessTokenCookie(loggedOutRefresh.response);
      await expectProtectedApiStatus('user', refreshed.token!, 401);
    } finally {
      await session.context.dispose();
    }
  });
});
