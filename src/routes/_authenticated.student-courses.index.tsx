import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/student-courses/')({
  beforeLoad: () => {
    throw redirect({ to: '/student/my-courses' })
  },
})
