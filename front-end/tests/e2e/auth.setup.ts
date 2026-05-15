import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const authDir = path.join(__dirname, '../../playwright/.auth');
const adminStatePath = path.join(authDir, 'admin.json');
const userStatePath = path.join(authDir, 'user.json');
const frontendBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const apiBaseURL = process.env.E2E_API_BASE_URL ?? frontendBaseURL;

const adminCredentials = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'admin123',
};

const e2eUser = {
  email: process.env.E2E_USER_EMAIL ?? 'e2e_test_user@example.com',
  password: process.env.E2E_USER_PASSWORD ?? '20031998',
  profile: {
    name: 'E2E Test User',
    dob: process.env.E2E_USER_DOB ?? '1998-03-20',
    department: 'QA',
    position: 'E2E Tester',
    phone: '0911111111',
    identityCard: '079098001111',
    bankAccount: '1111111111',
    bankName: 'Techcombank',
    role: 'USER',
  },
};

test('authenticate admin and user sessions', async ({ page, browser }) => {
  fs.mkdirSync(authDir, { recursive: true });

  await loginViaUi(page, '/admin/login', adminCredentials.email, adminCredentials.password, /\/admin\/dashboard/);
  await page.context().storageState({ path: adminStatePath });

  await ensureE2eUser(page);

  const userContext = await browser.newContext();
  const userPage = await userContext.newPage();

  try {
    await loginViaUi(userPage, '/login', e2eUser.email, e2eUser.password, /\/user\/home/);
    await userContext.storageState({ path: userStatePath });
  } finally {
    await userContext.close();
  }
});

async function loginViaUi(
  page: Page,
  loginPath: string,
  email: string,
  password: string,
  expectedRoute: RegExp,
) {
  await page.goto(loginPath);
  await page.getByTestId('login-email-input').fill(email);
  await page.getByTestId('login-password-input').fill(password);

  const loginResponse = page.waitForResponse(
    (response) => response.url().includes('/api/auth/login') && response.status() === 200,
  );

  await page.getByTestId('login-submit-btn').click();
  await loginResponse;
  await expect(page).toHaveURL(expectedRoute);
}

async function ensureE2eUser(page: Page) {
  const staffListResponse = await page.request.get(`${apiBaseURL}/api/staff`);
  expect(staffListResponse.ok()).toBeTruthy();

  const staffListPayload = await staffListResponse.json();
  const staffList = Array.isArray(staffListPayload.result) ? staffListPayload.result : [];
  const existingUser = staffList.find((staff) => staff.email === e2eUser.email);

  if (!existingUser) {
    const createResponse = await page.request.post(`${apiBaseURL}/api/staff`, {
      data: {
        ...e2eUser.profile,
        email: e2eUser.email,
      },
    });

    expect([201, 409]).toContain(createResponse.status());
    return;
  }

  if (existingUser.status !== 'ACTIVE') {
    const activateResponse = await page.request.patch(
      `${apiBaseURL}/api/staff/${existingUser.id}/status?status=ACTIVE`,
    );
    expect(activateResponse.ok()).toBeTruthy();
  }
}
