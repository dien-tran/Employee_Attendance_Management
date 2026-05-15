/**
 * Auth Service
 * Xử lý đăng nhập, đăng xuất, kiểm tra token
 * Sử dụng api-client để gọi API Gateway
 * Dùng HttpOnly Cookie (không lưu JWT ở localStorage)
 */

import { apiClient, type ApiResponse } from '@/lib/api-client'

export interface UserInfo {
  id: string
  staffId: string
  name: string
  email: string
  role: 'ADMIN' | 'USER'
  department?: string
  position?: string
  phone?: string
  image?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  tokenType: string
  expiresIn: number
  staffId: string
  name: string
  role: 'ADMIN' | 'USER'
}

export interface LoginResponse extends ApiResponse<LoginResult> {}

export interface StaffResponseDTO {
  id: string
  staffId: string
  name: string
  email: string
  department: string
  position: string
  onboardDate: string
  status: string
  phone: string
  identityCard: string
  bankAccount: string
  bankName: string
  dob: string
  role: 'ADMIN' | 'USER'
}

export const authService = {
  /**
   * Đăng nhập: Gửi username/password → API Gateway → Auth Service
   * Backend set HttpOnly Cookie tự động, không cần lưu JWT ở client
   */
  async login(data: LoginRequest): Promise<LoginResult> {
    try {
      const response = await apiClient.post<LoginResult>('/api/auth/login', {
        username: data.username,
        password: data.password,
      })
      return response.result
    } catch (error) {
      throw new Error('Invalid username or password')
    }
  },

  /**
   * Đăng xuất: Gọi logout API để invalidate token
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/auth/logout')
    } catch {
      // Vẫn cho phép logout local even if API fails
    }
  },

  /**
   * Lấy thông tin staff hiện tại (dùng staffId từ login result)
   */
  async getStaffProfile(staffId: string): Promise<StaffResponseDTO> {
    const response = await apiClient.get<StaffResponseDTO>(`/api/staff/${staffId}`)
    return response.result
  },
}