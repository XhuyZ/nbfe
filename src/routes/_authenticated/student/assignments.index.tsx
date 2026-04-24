import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CalendarClock, CircleUserRound, FileText, Trophy } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { getMyCourseAssignments, type AssignmentItem } from '@/lib/assignments-api'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/student/assignments/')({
  validateSearch: (search: Record<string, unknown>) => ({
    courseId: typeof search.courseId === 'string' ? search.courseId : undefined,
  }),
  component: AssignmentsIndexPage,
})

function formatAssignmentDate(value: string) {
  const date = new Date(value)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function AssignmentsIndexPage() {
  const { accessToken } = useAuth()
  const navigate = useNavigate()
  const { courseId } = Route.useSearch()

  const assignmentsQuery = useQuery<{ message: string; data: AssignmentItem[] }, Error>({
    queryKey: ['student-course-assignments', accessToken, courseId],
    enabled: Boolean(accessToken && courseId),
    queryFn: async () => getMyCourseAssignments(accessToken!, courseId!),
  })

  useEffect(() => {
    if (assignmentsQuery.isSuccess) {
      toast.success(assignmentsQuery.data.message)
    }
  }, [assignmentsQuery.isSuccess, assignmentsQuery.data?.message])

  useEffect(() => {
    if (assignmentsQuery.isError) {
      toast.error(assignmentsQuery.error.message)
    }
  }, [assignmentsQuery.isError, assignmentsQuery.error?.message])

  if (!courseId) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">My Assignments</h1>
          <p className="text-sm text-muted-foreground">Select a course from My Courses to view its enrolled assignments.</p>
        </div>

        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No course selected. Go to <span className="font-medium">My Courses</span> and choose{' '}
            <span className="font-medium">My assignments</span> on a joined course.
          </CardContent>
        </Card>
      </section>
    )
  }

  if (assignmentsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading assignments...</p>
  }

  if (assignmentsQuery.isError) {
    return <p className="text-sm text-destructive">{assignmentsQuery.error.message}</p>
  }

  const assignments = assignmentsQuery.data?.data ?? []
  const courseName = assignments[0]?.chapter?.course?.name

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">My Assignments</h1>
        <p className="text-sm text-muted-foreground">
          {courseName ? `Assignments for ${courseName}.` : 'Assignments available in your selected course.'}
        </p>
      </div>

      {assignments.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">No assignments available.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {assignments.map((assignment) => (
            <Card
              key={assignment.id}
              className="flex h-full flex-col rounded-2xl border-slate-200 shadow-sm transition-shadow hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-h-[82px] flex-1">
                    <CardTitle className="line-clamp-2 text-[1.45rem] leading-tight text-slate-900">{assignment.title}</CardTitle>
                    <CardDescription className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">
                      {assignment.description}
                    </CardDescription>
                  </div>
                    <Badge
                      className={
                        assignment.status === 'open'
                          ? 'shrink-0 border-0 bg-primary/10 text-primary hover:bg-primary/10'
                          : 'shrink-0 border-0 bg-slate-100 text-slate-500 hover:bg-slate-100'
                      }
                    >
                      {assignment.status === 'open' ? 'Open' : 'Closed'}
                    </Badge>
                  </div>

                  <div className="mt-5 space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <CircleUserRound className="h-4 w-4 text-slate-400" />
                      <span>{assignment.teacher.username}</span>
                    </div>

                    <div className={`flex items-center gap-2 ${assignment.status === 'open' ? 'text-rose-500' : 'text-slate-600'}`}>
                      <CalendarClock className={`h-4 w-4 ${assignment.status === 'open' ? 'text-rose-400' : 'text-slate-400'}`} />
                      <span>
                        {assignment.status === 'open' ? 'Due' : 'Closed'} {formatAssignmentDate(assignment.deadline)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <Trophy className="h-4 w-4 text-slate-400" />
                      <span>{assignment.maxScore ?? 100} points</span>
                    </div>
                  </div>

                  {assignment.chapter?.title ? (
                    <p className="mt-3 text-xs text-slate-400">{assignment.chapter.title}</p>
                  ) : (
                    <div className="mt-3 h-[16px]" />
                  )}
                </div>

                {assignment.status === 'open' ? (
                  <Button
                    className="mt-5 h-11 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-900"
                    onClick={() =>
                      navigate({
                        to: '/student/assignments/$assignmentId',
                        params: { assignmentId: assignment.id },
                        search: { courseId },
                      })
                    }
                  >
                    <FileText className="h-4 w-4" />
                    View details & submit
                  </Button>
                ) : (
                  <Button
                    className="mt-5 h-11 w-full rounded-xl border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-100"
                    variant="outline"
                    disabled
                  >
                    Closed
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
