import { expect, request as playwrightRequest, test, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import crypto from 'node:crypto'
import { apiBaseURL, coreInternalBaseURL, e2eUserEmail, requiredEnv } from './helpers/auth-token'

const adminStatePath = 'playwright/.auth/admin.json'
const userStatePath = 'playwright/.auth/user.json'
const createdAttendanceIds = new Set<string>()

const internalJwtConfig = {
  signedKey: requiredEnv('INTERNAL_JWT_SIGNED_KEY'),
  issuer: process.env.INTERNAL_JWT_ISSUER ?? 'ai-service',
  audience: process.env.INTERNAL_JWT_AUDIENCE ?? 'core-service',
  scope: process.env.INTERNAL_JWT_REQUIRED_SCOPE ?? 'attendance:sync',
}

interface StaffSummary {
  staffId: string
  name: string
  email: string
}

test.describe('AI attendance sync UI flow', () => {
  test.use({ storageState: userStatePath })

  test.afterAll(async ({ request }) => {
    await deleteCreatedAttendance(request)
  })

  test('syncs an AI attendance record and renders it for user and admin', async ({ browser, page }) => {
    const staff = await getE2eUserStaff()
    const attendance = buildAttendancePayload(staff.staffId)

    const syncResponse = await page.request.post(`${coreInternalBaseURL}/api/internal/attendance/sync`, {
      headers: {
        'X-Internal-Token': `Bearer ${createInternalJwt()}`,
      },
      data: attendance,
    })
    const syncPayload = await syncResponse.json()
    const syncedRecord = syncPayload.result

    expect(syncResponse.status()).toBe(201)
    expect(syncedRecord.staffId).toBe(staff.staffId)
    expect(syncedRecord.onTime).toBe(true)
    createdAttendanceIds.add(syncedRecord.id)

    await assertUserAttendancePage(page, syncedRecord.id)
    await assertAdminAttendancePage(browser, syncedRecord.id, staff)
  })
})

async function getE2eUserStaff() {
  const adminApi = await playwrightRequest.newContext({
    baseURL: apiBaseURL,
    storageState: adminStatePath,
  })

  try {
    const response = await adminApi.get('/api/staff')
    expect(response.status()).toBe(200)

    const payload = await response.json()
    const staffList = Array.isArray(payload.result) ? payload.result : []
    const staff = staffList.find((item: StaffSummary) => item.email === e2eUserEmail)

    if (!staff) {
      throw new Error(`E2E user staff not found for ${e2eUserEmail}`)
    }

    return staff as StaffSummary
  } finally {
    await adminApi.dispose()
  }
}

function buildAttendancePayload(staffId: string) {
  const today = new Date().toISOString().split('T')[0]

  return {
    staffId,
    type: 'CHECK_IN',
    timestamp: `${today}T08:02:15`,
    date: today,
    onTime: true,
  }
}

async function assertUserAttendancePage(page: Page, recordId: string) {
  const attendanceResponse = page.waitForResponse((response) => {
    return response.request().method() === 'GET'
      && response.url().includes('/api/core/attendance/my')
      && response.status() === 200
  })

  await page.goto('/user/attendance')
  await attendanceResponse
  await waitForLoadingToFinish(page, 'attendance-loading-state')

  await expect(page).toHaveURL(/\/user\/attendance/)
  await expect(page.getByTestId(`attendance-row-${recordId}`)).toBeVisible()
  await expect(page.getByTestId(`attendance-time-${recordId}`)).toHaveText('08:02')
  await expect(page.getByTestId(`attendance-type-${recordId}`)).toHaveText('Check In')
  await expect(page.getByTestId(`attendance-status-${recordId}`)).toHaveText('On Time')
}

async function assertAdminAttendancePage(browser: Browser, recordId: string, staff: StaffSummary) {
  const adminContext = await browser.newContext({ storageState: adminStatePath })
  const adminPage = await adminContext.newPage()

  try {
    const attendanceResponse = adminPage.waitForResponse((response) => {
      return response.request().method() === 'GET'
        && response.url().includes('/api/core/attendance/range')
        && response.status() === 200
    })
    const staffResponse = adminPage.waitForResponse((response) => {
      return response.request().method() === 'GET'
        && response.url().includes('/api/staff')
        && response.status() === 200
    })

    await adminPage.goto('/admin/attendance')
    await attendanceResponse
    await staffResponse
    await waitForLoadingToFinish(adminPage, 'admin-attendance-loading-state')

    await expect(adminPage).toHaveURL(/\/admin\/attendance/)
    await adminPage.getByTestId('admin-attendance-search-input').fill(staff.staffId)
    await expect(adminPage.getByTestId(`admin-attendance-row-${recordId}`)).toBeVisible()
    await expect(adminPage.getByTestId(`admin-attendance-employee-${recordId}`)).toHaveText(staff.name)
    await expect(adminPage.getByTestId(`admin-attendance-staff-id-${recordId}`)).toHaveText(staff.staffId)
    await expect(adminPage.getByTestId(`admin-attendance-time-${recordId}`)).toHaveText('08:02')
    await expect(adminPage.getByTestId(`admin-attendance-status-${recordId}`)).toHaveText('On Time')
  } finally {
    await adminContext.close()
  }
}

async function waitForLoadingToFinish(page: Page, testId: string) {
  const loadingState = page.getByTestId(testId)

  if (await loadingState.isVisible().catch(() => false)) {
    await loadingState.waitFor({ state: 'detached' })
  }
}

async function deleteCreatedAttendance(request: APIRequestContext) {
  for (const attendanceId of createdAttendanceIds) {
    const response = await request.delete(`${coreInternalBaseURL}/api/internal/attendance/${attendanceId}`, {
      headers: {
        'X-Internal-Token': `Bearer ${createInternalJwt()}`,
      },
    })

    expect([204, 404]).toContain(response.status())
  }
}

function createInternalJwt() {
  const now = Math.floor(Date.now() / 1000)
  const header = {
    alg: 'HS512',
    typ: 'JWT',
  }
  const payload = {
    iss: internalJwtConfig.issuer,
    aud: internalJwtConfig.audience,
    scope: internalJwtConfig.scope,
    iat: now,
    exp: now + 900,
    jti: crypto.randomUUID(),
  }
  const unsignedToken = `${base64UrlJson(header)}.${base64UrlJson(payload)}`
  const signature = crypto
    .createHmac('sha512', internalJwtConfig.signedKey)
    .update(unsignedToken)
    .digest('base64url')

  return `${unsignedToken}.${signature}`
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}
