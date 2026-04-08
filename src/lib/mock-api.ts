import type { UserRole } from '@/modules/auth/auth-context'

interface DashboardData {
  heading: string
  metrics: Array<{ label: string; value: string }>
}

const dashboards: Record<UserRole, DashboardData> = {
  student: {
    heading: 'Student Workspace',
    metrics: [
      { label: 'Assignments submitted', value: '12' },
      { label: 'Pending submissions', value: '3' },
      { label: 'Average score', value: '8.4 / 10' },
    ],
  },
  teacher: {
    heading: 'Teacher Workspace',
    metrics: [
      { label: 'Assignments to grade', value: '27' },
      { label: 'Active classes', value: '4' },
      { label: 'Average grading time', value: '11 mins' },
    ],
  },
  admin: {
    heading: 'Admin Workspace',
    metrics: [
      { label: 'Total users', value: '1,248' },
      { label: 'New submissions today', value: '189' },
      { label: 'System health', value: 'Healthy' },
    ],
  },
}

export async function getDashboardByRole(role: UserRole): Promise<DashboardData> {
  await new Promise((resolve) => setTimeout(resolve, 250))
  return dashboards[role]
}
