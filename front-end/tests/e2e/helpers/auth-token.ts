import { expect, request as playwrightRequest, type APIRequestContext, type APIResponse } from '@playwright/test';

const DEFAULT_FRONTEND_BASE_URL = 'http://localhost:3000';
const DEFAULT_CORE_INTERNAL_BASE_URL = 'http://localhost:8082';
const DEFAULT_E2E_USER_EMAIL = 'e2e_test_user@example.com';
const DEFAULT_E2E_USER_DOB = '1998-03-20';

export const frontendBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_FRONTEND_BASE_URL;
export const apiBaseURL = process.env.E2E_API_BASE_URL ?? frontendBaseURL;
export const coreInternalBaseURL = process.env.E2E_CORE_INTERNAL_BASE_URL ?? DEFAULT_CORE_INTERNAL_BASE_URL;
export const e2eUserEmail = process.env.E2E_USER_EMAIL ?? DEFAULT_E2E_USER_EMAIL;
export const e2eUserDob = process.env.E2E_USER_DOB ?? DEFAULT_E2E_USER_DOB;

export type TestRole = 'admin' | 'user';

export interface JwtPayload {
  exp: number;
  iat: number;
  jti: string;
  sessionId: string;
  sessionStartedAt: number;
  sessionExpiresAt: number;
  scope: string;
  staffId: string;
  sub: string;
}

export interface LoginSession {
  context: APIRequestContext;
  token: string;
  payload: JwtPayload;
  role: TestRole;
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for auth token E2E tests`);
  }
  return value;
}

export function credentialsFor(role: TestRole) {
  if (role === 'admin') {
    return {
      username: requiredEnv('E2E_ADMIN_EMAIL'),
      password: requiredEnv('E2E_ADMIN_PASSWORD'),
    };
  }

  return {
    username: e2eUserEmail,
    password: requiredEnv('E2E_USER_PASSWORD'),
  };
}

export async function newApiContext(extraHTTPHeaders?: Record<string, string>) {
  return playwrightRequest.newContext({
    baseURL: apiBaseURL,
    extraHTTPHeaders,
  });
}

export async function loginViaApi(role: TestRole): Promise<LoginSession> {
  const context = await newApiContext();
  const response = await context.post('/api/auth/login', {
    data: credentialsFor(role),
  });
  const payload = await response.json();
  const token = payload.result?.token;

  expect(response.status()).toBe(200);
  expect(token).toBeTruthy();
  expect(getAccessTokenSetCookie(response)).toBeTruthy();

  return {
    context,
    token,
    payload: decodeJwtPayload(token),
    role,
  };
}

export async function refreshAccessToken(context: APIRequestContext, token?: string) {
  const response = await context.post('/api/auth/refresh', token ? { data: { token } } : undefined);
  const payload = await response.json().catch(() => null);
  const refreshedToken = payload?.result?.token as string | undefined;

  return {
    response,
    payload,
    token: refreshedToken,
    jwt: refreshedToken ? decodeJwtPayload(refreshedToken) : null,
  };
}

export async function logoutAccessToken(context: APIRequestContext, token?: string) {
  return context.post('/api/auth/logout', token ? { data: { token } } : undefined);
}

export async function callProtectedApi(role: TestRole, token?: string) {
  const context = token
    ? await newApiContext({ Authorization: `Bearer ${token}` })
    : await newApiContext();

  try {
    const response = role === 'admin'
      ? await context.get('/api/staff')
      : await context.get('/api/profile/me');

    return response;
  } finally {
    await context.dispose();
  }
}

export async function expectProtectedApiStatus(role: TestRole, token: string, expectedStatus: number) {
  const context = await newApiContext({ Authorization: `Bearer ${token}` });

  try {
    const response = role === 'admin'
      ? await context.get('/api/staff')
      : await context.get('/api/profile/me');

    expect(response.status()).toBe(expectedStatus);
  } finally {
    await context.dispose();
  }
}

export function decodeJwtPayload(token: string): JwtPayload {
  const payload = token.split('.')[1];
  if (!payload) {
    throw new Error('JWT payload is missing');
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtPayload;
}

export function getAccessTokenSetCookie(response: APIResponse) {
  return response.headersArray().find((header) => {
    return header.name.toLowerCase() === 'set-cookie' && header.value.includes('access_token=');
  })?.value;
}

export function expectNoFreshAccessTokenCookie(response: APIResponse) {
  const setCookie = getAccessTokenSetCookie(response);

  if (!setCookie) {
    return;
  }

  expect(setCookie).not.toMatch(/access_token=[^.]+\.[^.]+\.[^;]+/);
}

export function expectSameSession(before: JwtPayload, after: JwtPayload) {
  expect(after.sessionId).toBe(before.sessionId);
  expect(after.sessionStartedAt).toBe(before.sessionStartedAt);
  expect(after.sessionExpiresAt).toBe(before.sessionExpiresAt);
}
