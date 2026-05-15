/**
 * Staff Service
 * Quản lý thông tin nhân viên (CRUD)
 * Tích hợp với API Gateway: http://api-gateway:8080/api/staff
 */

import { apiClient } from '@/lib/api-client'

export interface StaffCreationRequest {
  name: string
  email: string
  dob: string
  department: string
  position: string
  phone: string
  identityCard: string
  bankAccount: string
  bankName: string
  role: 'USER' | 'ADMIN'
}

export interface StaffUpdateRequest {
  name?: string
  email?: string
  department?: string
  position?: string
  phone?: string
  identityCard?: string
  bankAccount?: string
  bankName?: string
}

export interface StaffDTO {
  id: string
  staffId: string
  name: string
  email: string
  department: string
  position: string
  onboardDate: string
  status: 'ACTIVE' | 'INACTIVE'
  phone: string
  identityCard: string
  bankAccount: string
  bankName: string
  dob: string
  role: 'ADMIN' | 'USER'
}

export const staffService = {
  /**
   * Lấy danh sách toàn bộ nhân viên
   * GET /api/staff
   */
  async getAll(): Promise<StaffDTO[]> {
    const response = await apiClient.get<StaffDTO[]>('/api/staff')
    return response.result
  },

  /**
   * Tạo nhân viên mới
   * POST /api/staff
   */
  async create(data: StaffCreationRequest): Promise<StaffDTO> {
    const response = await apiClient.post<StaffDTO>('/api/staff', data)
    return response.result
  },

  /**
   * Cập nhật thông tin nhân viên
   * PUT /api/staff/{id}
   */
  async update(id: string, data: StaffUpdateRequest): Promise<StaffDTO> {
    const response = await apiClient.put<StaffDTO>(`/api/staff/${id}`, data)
    return response.result
  },

  /**
   * Thay đổi trạng thái nhân viên (ACTIVE / INACTIVE)
   * PATCH /api/staff/{id}/status?status={status}
   */
  async updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<StaffDTO> {
    const response = await apiClient.patch<StaffDTO>(`/api/staff/${id}/status?status=${status}`)
    return response.result
  },

  /**
   * Lấy thông tin một nhân viên
   * GET /api/staff/{id}
   */
  async getById(id: string): Promise<StaffDTO> {
    const response = await apiClient.get<StaffDTO>(`/api/staff/${id}`)
    return response.result
  },
}
