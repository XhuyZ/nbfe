import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/student-courses')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'student') {
      throw redirect({ to: `/${role}` as '/teacher' | '/admin' })
    }
  },
  component: StudentCoursesLayout,
})

function StudentCoursesLayout() {
  return <Outlet />
}
