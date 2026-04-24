import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/student/all-courses/$courseId')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/student/all-course/$courseId',
      params: { courseId: params.courseId },
    })
  },
})
