import { createFileRoute, redirect } from '@tanstack/react-router'

import { RoleDashboard } from '@/components/role-dashboard'

export const Route = createFileRoute('/_authenticated/student')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'student') {
      throw redirect({ to: `/${role}` as '/teacher' | '/admin' })
    }
  },
  component: StudentPage,
})

function StudentPage() {
  return <RoleDashboard role="student" />
}
