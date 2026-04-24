import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/teacher-courses')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'teacher') {
      throw redirect({ to: `/${role}` as '/student' | '/admin' })
    }

    throw redirect({ to: '/teacher/courses' })
  },
})
