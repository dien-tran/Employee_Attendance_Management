import { apiClient } from '@/lib/api-client'

export interface AttendanceDTO {
  id: string
  staffId: string
  type: 'CHECK_IN' | 'CHECK_OUT'
  timestamp: string
  date: string
  onTime: boolean | null
}

export const attendanceService = {
  async getMyAttendance(startDate?: string, endDate?: string): Promise<AttendanceDTO[]> {
    const params = buildDateRangeParams(startDate, endDate)
    const response = await apiClient.get<AttendanceDTO[]>(`/api/core/attendance/my${params}`)
    return response.result
  },

  async getAttendanceByRange(startDate: string, endDate: string): Promise<AttendanceDTO[]> {
    const params = buildDateRangeParams(startDate, endDate)
    const response = await apiClient.get<AttendanceDTO[]>(`/api/core/attendance/range${params}`)
    return response.result
  },
}

function buildDateRangeParams(startDate?: string, endDate?: string) {
  const params = new URLSearchParams()

  if (startDate) {
    params.set('startDate', startDate)
  }

  if (endDate) {
    params.set('endDate', endDate)
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}
