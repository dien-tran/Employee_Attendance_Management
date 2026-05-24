import { expect, test } from '@playwright/test';
import {
  expectSameSession,
  loginViaApi,
  refreshAccessToken,
} from './helpers/auth-token';

test.describe('Auth token TTL and sliding session deadline', () => {
  test.skip(process.env.E2E_TTL_MODE !== 'true', 'Run the existing docker-compose stack with short JWT TTL env values to enable this check.');

  test('rejects expired access token and does not extend the sliding session deadline', async () => {
    const session = await loginViaApi('user');
    const accessTtl = Number(process.env.E2E_SHORT_ACCESS_TTL_SECONDS ?? '0');
    const slidingTtl = Number(process.env.E2E_SHORT_SLIDING_SESSION_TTL_SECONDS ?? '0');

    expect(accessTtl).toBeGreaterThan(0);
    expect(slidingTtl).toBeGreaterThan(accessTtl);

    try {
      await expect.poll(async () => {
        const expiredRefresh = await refreshAccessToken(session.context, session.token);
        return expiredRefresh.response.status();
      }, {
        timeout: (accessTtl + 4) * 1000,
        intervals: [500, 1000],
      }).not.toBe(200);

      const freshSession = await loginViaApi('user');

      try {
        const firstRefresh = await refreshAccessToken(freshSession.context);
        expect(firstRefresh.response.status()).toBe(200);
        expectSameSession(freshSession.payload, firstRefresh.jwt!);
        expect(firstRefresh.jwt!.exp).toBeLessThanOrEqual(firstRefresh.jwt!.sessionExpiresAt);

        const secondRefresh = await refreshAccessToken(freshSession.context);
        expect(secondRefresh.response.status()).toBe(200);
        expectSameSession(freshSession.payload, secondRefresh.jwt!);
        expect(secondRefresh.jwt!.exp).toBeLessThanOrEqual(secondRefresh.jwt!.sessionExpiresAt);

        await expect.poll(async () => {
          const deadlineRefresh = await refreshAccessToken(freshSession.context, secondRefresh.token);
          return deadlineRefresh.response.status();
        }, {
          timeout: (slidingTtl + 4) * 1000,
          intervals: [500, 1000],
        }).not.toBe(200);
      } finally {
        await freshSession.context.dispose();
      }
    } finally {
      await session.context.dispose();
    }
  });
});
