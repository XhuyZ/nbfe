import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/student/all-courses/')({
  beforeLoad: () => {
    throw redirect({ to: '/student/all-course' })
  },
})
