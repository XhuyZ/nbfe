import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/student-courses')({
  beforeLoad: ({ context, location }) => {
    const role = context.auth.user?.role
    if (role && role !== 'student') {
      throw redirect({ to: `/${role}` as '/teacher' | '/admin' })
    }

    if (location.pathname === '/student-courses' || location.pathname === '/student-courses/') {
      throw redirect({ to: '/student/my-courses' })
    }
  },
  component: StudentCoursesLayout,
})

function StudentCoursesLayout() {
  return <Outlet />
}
