import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
  type Response,
} from '@playwright/test'
import crypto from 'node:crypto'
import { apiBaseURL, coreInternalBaseURL, e2eUserEmail } from './helpers/auth-token'

const adminStatePath = 'playwright/.auth/admin.json'
const userStatePath = 'playwright/.auth/user.json'
const createdAttendanceIds = new Set<string>()

interface StaffSummary {
  id: string
  staffId: string
  name: string
  email: string
  department: string
  position?: string
}

interface AttendanceSummary {
  id: string
  staffId: string
  type: 'CHECK_IN' | 'CHECK_OUT'
  timestamp: string
  date: string
  onTime: boolean | null
}

test.describe('Data duplication checks', () => {
  test.afterAll(async ({ request }) => {
    await deleteCreatedAttendance(request)
  })

  test.describe('Admin employee list', () => {
    test.use({ storageState: adminStatePath })

    test('renders exactly one employee component per API staff after list re-renders', async ({ page }) => {
      const staffResponsePromise = page.waitForResponse((response) => {
        return response.request().method() === 'GET'
          && response.url().includes('/api/staff')
          && response.status() === 200
      })

      await page.goto('/admin/employees')
      const staffList = await readResult<StaffSummary>(await staffResponsePromise)
      await waitForLoadingToFinish(page, 'employee-loading-state')

      await expect(page).toHaveURL(/\/admin\/employees/)
      await assertRenderedIds(page, '[data-testid^="staff-card-"]', 'staff-card-', staffList.map(getStaffRenderId))

      await page.getByTestId('employee-view-list').click()
      await assertRenderedIds(page, '[data-testid^="staff-row-"]', 'staff-row-', staffList.map(getStaffRenderId))

      if (staffList.length > 0) {
        const targetQuery = staffList[0].staffId || staffList[0].name
        const expectedFilteredStaff = filterStaff(staffList, targetQuery)

        await page.getByTestId('employee-search-input').fill(targetQuery)
        await assertRenderedIds(
          page,
          '[data-testid^="staff-row-"]',
          'staff-row-',
          expectedFilteredStaff.map(getStaffRenderId),
        )

        await page.getByTestId('employee-search-input').clear()
        await assertRenderedIds(page, '[data-testid^="staff-row-"]', 'staff-row-', staffList.map(getStaffRenderId))
      }
    })
  })

  test.describe('User attendance history', () => {
    test.use({ storageState: userStatePath })

    test('renders API attendance records once when filters re-fetch data', async ({ page }) => {
      const staff = await getE2eUserStaff()
      const attendance = await createAttendanceRecord(page.request, staff.staffId)
      createdAttendanceIds.add(attendance.id)

      const monthlyResponsePromise = waitForMyAttendanceResponse(page)
      await page.goto('/user/attendance')
      const monthlyRecords = await readResult<AttendanceSummary>(await monthlyResponsePromise)
      await waitForLoadingToFinish(page, 'attendance-loading-state')

      await expect(page).toHaveURL(/\/user\/attendance/)
      await assertRenderedIds(page, '[data-testid^="attendance-row-"]', 'attendance-row-', monthlyRecords.map((record) => record.id))

      const today = getToday()
      const dayResponsePromise = waitForMyAttendanceResponse(page)
      await page.getByTestId('attendance-date-filter').fill(today)
      const dayRecords = await readResult<AttendanceSummary>(await dayResponsePromise)
      await waitForLoadingToFinish(page, 'attendance-loading-state')
      await assertRenderedIds(page, '[data-testid^="attendance-row-"]', 'attendance-row-', dayRecords.map((record) => record.id))

      const monthlyReloadResponsePromise = waitForMyAttendanceResponse(page)
      await page.getByTestId('attendance-clear-filters').click()
      const monthlyReloadRecords = await readResult<AttendanceSummary>(await monthlyReloadResponsePromise)
      await waitForLoadingToFinish(page, 'attendance-loading-state')
      await assertRenderedIds(
        page,
        '[data-testid^="attendance-row-"]',
        'attendance-row-',
        monthlyReloadRecords.map((record) => record.id),
      )
    })
  })
})

async function readResult<T>(response: Response): Promise<T[]> {
  const payload = await response.json()
  return Array.isArray(payload.result) ? payload.result : []
}

async function assertRenderedIds(page: Page, selector: string, prefix: string, ids: string[]) {
  const uniqueApiIds = new Set(ids)
  expect(uniqueApiIds.size).toBe(ids.length)

  const rows = page.locator(selector)
  await expect(rows).toHaveCount(ids.length)

  const actualTestIds = await rows.evaluateAll((elements) => {
    return elements.map((element) => element.getAttribute('data-testid') ?? '')
  })
  const expectedTestIds = ids.map((id) => `${prefix}${id}`)

  expect(new Set(actualTestIds).size).toBe(actualTestIds.length)
  expect(actualTestIds.sort()).toEqual(expectedTestIds.sort())
}

async function waitForLoadingToFinish(page: Page, testId: string) {
  const loadingState = page.getByTestId(testId)

  if (await loadingState.isVisible().catch(() => false)) {
    await loadingState.waitFor({ state: 'detached' })
  }
}

function getStaffRenderId(staff: StaffSummary) {
  return staff.staffId || staff.id
}

function filterStaff(staffList: StaffSummary[], query: string) {
  const normalizedQuery = query.toLowerCase()

  return staffList.filter((staff) => {
    return staff.name.toLowerCase().includes(normalizedQuery)
      || staff.email.toLowerCase().includes(normalizedQuery)
      || staff.staffId?.toLowerCase().includes(normalizedQuery)
      || staff.position?.toLowerCase().includes(normalizedQuery)
  })
}

function waitForMyAttendanceResponse(page: Page) {
  return page.waitForResponse((response) => {
    return response.request().method() === 'GET'
      && response.url().includes('/api/core/attendance/my')
      && response.status() === 200
  })
}

async function getE2eUserStaff() {
  const adminApi = await playwrightRequest.newContext({
    baseURL: apiBaseURL,
    storageState: adminStatePath,
  })

  try {
    const response = await adminApi.get('/api/staff')
    expect(response.status()).toBe(200)

    const staffList = await readApiResult<StaffSummary>(response)
    const staff = staffList.find((item) => item.email === e2eUserEmail)

    if (!staff) {
      throw new Error(`E2E user staff not found for ${e2eUserEmail}`)
    }

    return staff
  } finally {
    await adminApi.dispose()
  }
}

async function createAttendanceRecord(request: APIRequestContext, staffId: string) {
  const today = getToday()
  const response = await request.post(`${coreInternalBaseURL}/api/internal/attendance/sync`, {
    headers: {
      'X-Internal-Token': `Bearer ${createInternalJwt()}`,
    },
    data: {
      staffId,
      type: 'CHECK_IN',
      timestamp: `${today}T08:09:15`,
      date: today,
      onTime: true,
    },
  })

  expect(response.status()).toBe(201)
  const payload = await response.json()
  return payload.result as AttendanceSummary
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

async function readApiResult<T>(response: APIResponse): Promise<T[]> {
  const payload = await response.json()
  return Array.isArray(payload.result) ? payload.result : []
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function createInternalJwt() {
  const now = Math.floor(Date.now() / 1000)
  const header = {
    alg: 'HS512',
    typ: 'JWT',
  }
  const payload = {
    iss: process.env.INTERNAL_JWT_ISSUER ?? 'ai-service',
    aud: process.env.INTERNAL_JWT_AUDIENCE ?? 'core-service',
    scope: process.env.INTERNAL_JWT_REQUIRED_SCOPE ?? 'attendance:sync',
    iat: now,
    exp: now + 900,
    jti: crypto.randomUUID(),
  }
  const signedKey = process.env.INTERNAL_JWT_SIGNED_KEY

  if (!signedKey) {
    throw new Error('INTERNAL_JWT_SIGNED_KEY is required for attendance duplication E2E tests')
  }

  const unsignedToken = `${base64UrlJson(header)}.${base64UrlJson(payload)}`
  const signature = crypto
    .createHmac('sha512', signedKey)
    .update(unsignedToken)
    .digest('base64url')

  return `${unsignedToken}.${signature}`
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}
