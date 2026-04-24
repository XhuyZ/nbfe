import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/assignments/$assignmentId')({
  beforeLoad: ({ location, params }) => {
    throw redirect({
      to: '/student/assignments/$assignmentId',
      params: { assignmentId: params.assignmentId },
      search: location.search as never,
    })
  },
})
