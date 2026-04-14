import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getEnrolledCourses, type CourseItem } from '@/lib/courses-api'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/student-courses/')({
  component: StudentCoursesIndexPage,
})

function StudentCoursesIndexPage() {
  const { accessToken } = useAuth()
  const navigate = useNavigate()

  const enrolledQuery = useQuery<{ message: string; data: CourseItem[] }, Error>({
    queryKey: ['student-enrolled-courses', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getEnrolledCourses(accessToken!),
  })

  useEffect(() => {
    if (enrolledQuery.isSuccess) toast.success(enrolledQuery.data.message)
  }, [enrolledQuery.isSuccess, enrolledQuery.data?.message])

  useEffect(() => {
    if (enrolledQuery.isError) toast.error(enrolledQuery.error.message)
  }, [enrolledQuery.isError, enrolledQuery.error?.message])

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Courses</h1>
        <p className="text-sm text-muted-foreground">Courses you enrolled in. Open details to check chapter roadmap and assignments.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enrolled Courses</CardTitle>
          <CardDescription>Courses you have joined.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {enrolledQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading enrolled courses...</p> : null}
          {enrolledQuery.isError ? <p className="text-sm text-destructive">{enrolledQuery.error.message}</p> : null}
          {enrolledQuery.isSuccess && enrolledQuery.data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No enrolled courses found.</p>
          ) : null}

          {enrolledQuery.isSuccess
            ? enrolledQuery.data.data.map((course) => (
                <div key={course.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{course.name}</p>
                      <p className="text-xs text-muted-foreground">{course.description}</p>
                    </div>
                    <Badge variant={course.isPublished ? 'default' : 'outline'}>
                      {course.isPublished ? 'published' : 'draft'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Teacher: {course.teacher.username}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Chapters: {course.chapters.length}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate({ to: '/student-courses/$courseId', params: { courseId: course.id } })}
                    >
                      View details
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => navigate({ to: '/assignments' })}>
                      My assignments
                    </Button>
                  </div>
                </div>
              ))
            : null}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Want to join a new course? Go to <span className="font-medium">All Courses</span> from sidebar.
      </div>
    </section>
  )
}
