import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CalendarClock, CircleUserRound, FileText, Trophy } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAllAssignments, type AssignmentItem } from '@/lib/assignments-api'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/assignments/')({
  component: AssignmentsIndexPage,
})

function AssignmentsIndexPage() {
  const { accessToken } = useAuth()
  const navigate = useNavigate()

  const assignmentsQuery = useQuery<{ message: string; data: AssignmentItem[] }, Error>({
    queryKey: ['assignments', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getAllAssignments(accessToken!),
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

  if (assignmentsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading assignments...</p>
  }

  if (assignmentsQuery.isError) {
    return <p className="text-sm text-destructive">{assignmentsQuery.error.message}</p>
  }

  const assignments = assignmentsQuery.data?.data ?? []

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">My Assignments</h1>
        <p className="text-sm text-muted-foreground">Assignments available for your learning journey.</p>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">No assignments available.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assignments.map((assignment) => (
            <Card key={assignment.id} className="transition-shadow hover:shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="line-clamp-2 text-lg">{assignment.title}</CardTitle>
                  <Badge variant={assignment.status === 'open' ? 'default' : 'outline'}>{assignment.status}</Badge>
                </div>
                <CardDescription className="line-clamp-2">{assignment.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <CircleUserRound className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Teacher:</span>
                  <span className="font-medium">{assignment.teacher.username}</span>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Deadline:</span>
                  <span className="font-medium">{new Date(assignment.deadline).toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Max score:</span>
                  <span className="font-medium">{assignment.maxScore ?? 100}</span>
                </div>

                {assignment.status === 'open' ? (
                  <Button
                    className="w-full"
                    onClick={() => navigate({ to: '/assignments/$assignmentId', params: { assignmentId: assignment.id } })}
                  >
                    <FileText className="h-4 w-4" />
                    View details & submit
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" disabled>
                    Closed - submission unavailable
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
