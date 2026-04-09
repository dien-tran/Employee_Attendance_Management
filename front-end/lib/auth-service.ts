// Mock Auth Service

export interface UserInfo {
  id: string
  name: string
  email: string
  role: "USER" | "ADMIN"
  [key: string]: any
}

export interface AuthResponse {
  access_token: string
  role: "USER" | "ADMIN"
  user_info: UserInfo
}

const mockDb = {
  admin: {
    password: "admin",
    response: {
      access_token: "mock-jwt-admin-token-12345",
      role: "ADMIN" as const,
      user_info: {
        id: "admin-1",
        name: "Admin User",
        email: "admin@company.com",
        role: "ADMIN" as const,
      },
    },
  },
  user: {
    password: "user",
    response: {
      access_token: "mock-jwt-user-token-67890",
      role: "USER" as const,
      user_info: {
        id: "1", // matches Sarah Chen in mock-data.ts
        name: "Sarah Chen",
        email: "sarah.chen@company.com",
        role: "USER" as const,
        department: "Engineering",
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      },
    },
  },
}

export const authService = {
  async login(username: string, password: string):Promise<AuthResponse> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800))

    const account = mockDb[username as keyof typeof mockDb]

    if (!account || account.password !== password) {
      throw new Error("Invalid username or password")
    }

    return account.response
  },

  async logout(): Promise<void> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 400))
    // We do not need to do anything server-side for this mock
  },
}
