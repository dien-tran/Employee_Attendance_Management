import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const adminStatePath = 'playwright/.auth/admin.json';
const frontendBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const apiBaseURL = process.env.E2E_API_BASE_URL ?? frontendBaseURL;
const createdStaffIds = new Set<string>();

test.describe('Admin login UI validation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows required field errors on empty login submit', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByTestId('login-submit-btn').click();

    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByTestId('login-email-error')).toHaveText('Email is required');
    await expect(page.getByTestId('login-password-error')).toHaveText('Password is required');
  });
});

test.describe('Admin employee management', () => {
  test.use({ storageState: adminStatePath });

  test.afterAll(async ({ request }) => {
    await deactivateCreatedStaff(request);
  });

  test('creates an employee and renders the new staff card', async ({ page }) => {
    const staff = buildE2eStaff();

    await page.goto('/admin/employees');
    await expect(page).toHaveURL(/\/admin\/employees/);
    await waitForEmployeesToLoad(page);

    await page.getByTestId('employee-add-btn').click();
    await expect(page.getByTestId('employee-create-modal')).toBeVisible();

    await page.getByTestId('employee-name-input').fill(staff.name);
    await page.getByTestId('employee-email-input').fill(staff.email);
    await page.getByTestId('employee-department-select').selectOption(staff.department);
    await page.getByTestId('employee-position-input').fill(staff.position);
    await page.getByTestId('employee-phone-input').fill(staff.phone);
    await page.getByTestId('employee-dob-input').fill(staff.dob);
    await page.getByTestId('employee-identity-card-input').fill(staff.identityCard);
    await page.getByTestId('employee-bank-account-input').fill(staff.bankAccount);
    await page.getByTestId('employee-bank-name-input').fill(staff.bankName);
    await page.getByTestId('employee-role-select').selectOption(staff.role);

    const createResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === 'POST'
        && response.url().includes('/api/staff')
        && response.status() === 201;
    });

    await page.getByTestId('employee-create-submit').click();
    const createResponse = await createResponsePromise;
    const payload = await createResponse.json();
    const createdStaff = payload.result;

    expect(createResponse.status()).toBe(201);
    expect(createdStaff.email).toBe(staff.email);
    createdStaffIds.add(createdStaff.id);

    await expect(page).toHaveURL(/\/admin\/employees/);
    await expect(page.getByTestId('toast-success-msg')).toContainText('Employee created successfully');
    await expect(page.getByTestId(`staff-card-${createdStaff.staffId}`)).toBeVisible();
    await expect(page.getByTestId(`staff-name-${createdStaff.staffId}`)).toHaveText(staff.name);
  });
});

async function waitForEmployeesToLoad(page: Page) {
  const loadingState = page.getByTestId('employee-loading-state');

  if (await loadingState.isVisible().catch(() => false)) {
    await loadingState.waitFor({ state: 'detached' });
  }
}

function buildE2eStaff() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    name: `E2E Admin Staff ${suffix}`,
    email: `e2e_admin_staff_${suffix}@example.com`,
    dob: '1998-03-20',
    department: 'IT',
    position: 'E2E Tester',
    phone: '0912223333',
    identityCard: `079098${Date.now().toString().slice(-6)}`,
    bankAccount: `222${Date.now().toString().slice(-7)}`,
    bankName: 'Techcombank',
    role: 'USER',
  };
}

async function deactivateCreatedStaff(request: APIRequestContext) {
  for (const staffId of createdStaffIds) {
    const response = await request.patch(`${apiBaseURL}/api/staff/${staffId}/status?status=INACTIVE`);
    expect([200, 404]).toContain(response.status());
  }
}
