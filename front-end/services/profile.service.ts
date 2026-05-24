import { apiClient } from '@/lib/api-client'
import type { StaffDTO } from '@/services/staff.service'

export interface ProfileUpdateRequest {
  name: string
  department: string
  phone: string
}

export const profileService = {
  async getMe(): Promise<StaffDTO> {
    const response = await apiClient.get<StaffDTO>('/api/profile/me')
    return response.result
  },

  async updateMe(data: ProfileUpdateRequest): Promise<StaffDTO> {
    const response = await apiClient.put<StaffDTO>('/api/profile/me', data)
    return response.result
  },
}
