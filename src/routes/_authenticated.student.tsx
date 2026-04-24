import { Outlet, createFileRoute, redirect, useLocation } from '@tanstack/react-router'

import { StudentDashboard } from '@/components/student-dashboard'

export const Route = createFileRoute('/_authenticated/student')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'student') {
      throw redirect({ to: `/${role}` as '/teacher' | '/admin' })
    }
  },
  component: StudentRoute,
})

function StudentRoute() {
  const location = useLocation()

  if (location.pathname !== '/student' && location.pathname !== '/student/') {
    return <Outlet />
  }

  return <StudentDashboard />
}
