import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/submissions')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'student') {
      throw redirect({ to: `/${role}` as '/teacher' | '/admin' })
    }

    throw redirect({ to: '/student/submissions' })
  },
})
