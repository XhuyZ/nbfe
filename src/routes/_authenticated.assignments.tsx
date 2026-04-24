import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/assignments')({
  beforeLoad: ({ context, location }) => {
    const role = context.auth.user?.role
    if (role && role !== 'student') {
      throw redirect({ to: `/${role}` as '/teacher' | '/admin' })
    }

    if (location.pathname === '/assignments' || location.pathname === '/assignments/') {
      throw redirect({
        to: '/student/assignments',
        search: location.search as never,
      })
    }
  },
  component: AssignmentsLayout,
})

function AssignmentsLayout() {
  return <Outlet />
}
