import { expect, test, type Page } from '@playwright/test';

const userStatePath = 'playwright/.auth/user.json';

type EditableProfile = {
  name: string;
  department: string;
  phone: string;
};

type ProfileSnapshot = EditableProfile & {
  employeeId: string;
  email: string;
};

test.describe('User profile management', () => {
  test.use({ storageState: userStatePath });

  test('updates profile information and restores the original values', async ({ page }) => {
    let currentProfile: ProfileSnapshot | null = null;
    let originalProfile: ProfileSnapshot | null = null;

    await page.route('**/api/profile/me', async (route) => {
      const request = route.request();

      if (request.method() !== 'PUT') {
        await route.continue();
        return;
      }

      const requestBody = request.postDataJSON() as Partial<EditableProfile>;
      const baseProfile = currentProfile ?? originalProfile;

      if (!baseProfile) {
        throw new Error('Profile snapshot must be loaded before update');
      }

      currentProfile = {
        ...baseProfile,
        name: requestBody.name ?? baseProfile.name,
        department: requestBody.department ?? baseProfile.department,
        phone: requestBody.phone ?? baseProfile.phone,
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          message: 'Profile updated successfully',
          result: buildStaffResponse(currentProfile),
        }),
      });
    });

    const loadProfileResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === 'GET'
        && response.url().includes('/api/profile/me')
        && response.status() === 200;
    });

    await page.goto('/user/profile');
    await expect(page).toHaveURL(/\/user\/profile/);
    const loadProfileResponse = await loadProfileResponsePromise;
    const loadProfilePayload = await loadProfileResponse.json();
    await expect(page.getByTestId('profile-name-value')).toBeVisible();
    await expect(page.getByTestId('profile-name-value')).toHaveText(loadProfilePayload.result.name);

    currentProfile = await readProfileSnapshot(page);
    originalProfile = { ...currentProfile };
    const updatedProfile: EditableProfile = {
      name: `E2E Profile User ${Date.now()}`,
      department: 'Automation QA',
      phone: '0999888777',
    };

    try {
      await submitProfileUpdate(page, updatedProfile);
      await assertProfileVisible(page, updatedProfile);
      await expect(page.getByTestId('toast-success-msg')).toContainText('Profile updated successfully');
    } finally {
      if (originalProfile) {
        await submitProfileUpdate(page, originalProfile);
        await assertProfileVisible(page, originalProfile);
      }
    }
  });
});

async function submitProfileUpdate(page: Page, profile: EditableProfile) {
  await page.getByTestId('profile-edit-btn').click();
  await expect(page.getByTestId('profile-edit-modal')).toBeVisible();

  await page.getByTestId('profile-name-input').fill(profile.name);
  await page.getByTestId('profile-department-input').fill(profile.department);
  await page.getByTestId('profile-phone-input').fill(profile.phone);

  const updateResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === 'PUT'
      && response.url().includes('/api/profile/me')
      && response.status() === 200;
  });

  await page.getByTestId('profile-save-submit').click();
  const updateResponse = await updateResponsePromise;
  const payload = await updateResponse.json();

  expect(updateResponse.status()).toBe(200);
  expect(payload.result).toMatchObject({
    name: profile.name,
    department: profile.department,
    phone: profile.phone,
  });
  await expect(page.getByTestId('profile-edit-modal')).toBeHidden();
}

async function readProfileSnapshot(page: Page): Promise<ProfileSnapshot> {
  const phoneText = (await page.getByTestId('profile-phone-value').innerText()).trim();

  return {
    employeeId: (await page.getByTestId('profile-employee-id').innerText()).trim(),
    name: (await page.getByTestId('profile-name-value').innerText()).trim(),
    email: (await page.getByTestId('profile-email-value').innerText()).trim(),
    department: (await page.getByTestId('profile-department-value').innerText()).trim(),
    phone: phoneText === 'Not provided' ? '' : phoneText,
  };
}

async function assertProfileVisible(page: Page, profile: EditableProfile) {
  await expect(page.getByTestId('profile-name-value')).toHaveText(profile.name);
  await expect(page.getByTestId('profile-department-value')).toHaveText(profile.department);
  await expect(page.getByTestId('profile-phone-value')).toHaveText(profile.phone || 'Not provided');
}

function buildStaffResponse(profile: ProfileSnapshot) {
  return {
    id: profile.employeeId,
    staffId: profile.employeeId,
    name: profile.name,
    email: profile.email,
    department: profile.department,
    position: 'E2E Tester',
    onboardDate: '2026-05-15',
    status: 'ACTIVE',
    phone: profile.phone,
    identityCard: '079098001111',
    bankAccount: '1111111111',
    bankName: 'Techcombank',
    dob: '1998-03-20',
    role: 'USER',
  };
}
