// Mock data for the attendance system

export interface Employee {
  id: string
  name: string
  email: string
  role: string
  department: string
  image?: string
  status: "online" | "offline" | "away" | "busy"
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: "present" | "late" | "absent" | "half-day"
  hoursWorked: number | null
}

export const employees: Employee[] = [
  {
    id: "1",
    name: "Sarah Chen",
    email: "sarah.chen@company.com",
    role: "Senior Developer",
    department: "Engineering",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    status: "online",
  },
  {
    id: "2",
    name: "Marcus Johnson",
    email: "marcus.johnson@company.com",
    role: "Product Manager",
    department: "Product",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    status: "online",
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    email: "emily.rodriguez@company.com",
    role: "UX Designer",
    department: "Design",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    status: "away",
  },
  {
    id: "4",
    name: "David Kim",
    email: "david.kim@company.com",
    role: "Backend Engineer",
    department: "Engineering",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    status: "busy",
  },
  {
    id: "5",
    name: "Lisa Thompson",
    email: "lisa.thompson@company.com",
    role: "HR Manager",
    department: "Human Resources",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    status: "online",
  },
  {
    id: "6",
    name: "James Wilson",
    email: "james.wilson@company.com",
    role: "DevOps Engineer",
    department: "Engineering",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    status: "offline",
  },
  {
    id: "7",
    name: "Anna Martinez",
    email: "anna.martinez@company.com",
    role: "Data Analyst",
    department: "Analytics",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
    status: "online",
  },
  {
    id: "8",
    name: "Michael Brown",
    email: "michael.brown@company.com",
    role: "Tech Lead",
    department: "Engineering",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face",
    status: "online",
  },
  {
    id: "9",
    name: "Jessica Lee",
    email: "jessica.lee@company.com",
    role: "Marketing Manager",
    department: "Marketing",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face",
    status: "away",
  },
  {
    id: "10",
    name: "Robert Taylor",
    email: "robert.taylor@company.com",
    role: "QA Engineer",
    department: "Engineering",
    image: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=100&h=100&fit=crop&crop=face",
    status: "offline",
  },
]

// Deterministic random number generator for stable SSR hydration
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate attendance records for the past 30 days
function generateAttendanceRecords(): AttendanceRecord[] {
  const records: AttendanceRecord[] = []
  // Use a fixed reference date to prevent hydration errors across midnight/timezones
  const baseDate = new Date("2024-05-20T12:00:00Z")

  for (let day = 0; day < 30; day++) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() - day)
    const dateStr = date.toISOString().split("T")[0]

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue

    for (const employee of employees) {
      // Deterministic seed based on employee and day
      const seed = parseInt(employee.id) * 100 + day;
      const rand = seededRandom(seed);
      
      let status: AttendanceRecord["status"]
      let checkIn: string | null = null
      let checkOut: string | null = null
      let hoursWorked: number | null = null

      if (rand > 0.95) {
        status = "absent"
      } else if (rand > 0.85) {
        status = "late"
        checkIn = `09:${Math.floor(seededRandom(seed + 1) * 30) + 15}`
        checkOut = `18:${Math.floor(seededRandom(seed + 2) * 30)}`
        hoursWorked = 7 + seededRandom(seed + 3)
      } else if (rand > 0.8) {
        status = "half-day"
        checkIn = "09:00"
        checkOut = "13:00"
        hoursWorked = 4
      } else {
        status = "present"
        checkIn = `08:${Math.floor(seededRandom(seed + 4) * 30).toString().padStart(2, "0")}`
        checkOut = `17:${Math.floor(seededRandom(seed + 5) * 30).toString().padStart(2, "0")}`
        hoursWorked = 8 + seededRandom(seed + 6)
      }

      records.push({
        id: `${employee.id}-${dateStr}`,
        employeeId: employee.id,
        employeeName: employee.name,
        date: dateStr,
        checkIn,
        checkOut,
        status,
        hoursWorked: hoursWorked ? parseFloat(hoursWorked.toFixed(1)) : null,
      })
    }
  }

  return records.sort((a, b) => b.date.localeCompare(a.date))
}

export const attendanceRecords = generateAttendanceRecords()

// Dashboard statistics
export function getDashboardStats() {
  const today = "2024-05-20"
  const todayRecords = attendanceRecords.filter((r) => r.date === today)

  const present = todayRecords.filter((r) => r.status === "present").length
  const late = todayRecords.filter((r) => r.status === "late").length
  const absent = todayRecords.filter((r) => r.status === "absent").length
  const total = employees.length

  return {
    totalEmployees: total,
    presentToday: present + late,
    lateToday: late,
    absentToday: absent,
    onTimePercentage: total > 0 ? Math.round((present / total) * 100) : 0,
    attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
  }
}

// Get current logged-in employee (mock - returns first employee)
export function getCurrentEmployee(): Employee {
  return employees[0]
}

// Chatbot responses
export const chatbotResponses: Record<string, string> = {
  default: "I'm here to help with attendance-related questions. Try asking about today's attendance, employee status, or how to check in.",
  greeting: "Hello! I'm the AttendFlow assistant. How can I help you with attendance management today?",
  attendance: "Today we have a 92% attendance rate. 8 employees are present, 1 is late, and 1 is absent.",
  checkin: "To check in, head to the Check-in page and position your face within the camera frame. The system will automatically detect and verify your identity.",
  late: "Late arrivals today: Marcus Johnson checked in at 09:22. Overall, we've had a 5% late arrival rate this week.",
  employees: "We currently have 10 registered employees across 5 departments: Engineering, Product, Design, HR, and Marketing.",
  help: "I can help you with:\n- Checking today's attendance status\n- Understanding how to use face recognition\n- Viewing employee information\n- Generating attendance reports\n\nJust ask away!",
}
