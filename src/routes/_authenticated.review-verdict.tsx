import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/review-verdict')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role

    if (role === 'teacher') {
      throw redirect({ to: '/teacher/review-verdict' })
    }

    if (role === 'admin') {
      throw redirect({ to: '/admin/review-verdict' })
    }

    throw redirect({ to: '/student' })
  },
})
