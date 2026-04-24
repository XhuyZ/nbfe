import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/assignments/')({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: '/student/assignments',
      search: location.search as never,
    })
  },
})
