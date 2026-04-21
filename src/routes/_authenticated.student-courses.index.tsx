import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BookOpen, Compass, UserRound } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getEnrolledCourses, type CourseItem } from '@/lib/courses-api'
import { getStudentSubmissions, type SubmissionItem } from '@/lib/submissions-api'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/student-courses/')({
  component: StudentCoursesIndexPage,
})

function StudentCoursesIndexPage() {
  const { accessToken } = useAuth()

  const enrolledQuery = useQuery<{ message: string; data: CourseItem[] }, Error>({
    queryKey: ['student-enrolled-courses', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getEnrolledCourses(accessToken!),
  })
  const submissionsQuery = useQuery<{ message: string; data: SubmissionItem[] }, Error>({
    queryKey: ['student-course-progress-submissions', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getStudentSubmissions(accessToken!),
  })

  useEffect(() => {
    if (enrolledQuery.isSuccess) toast.success(enrolledQuery.data.message)
  }, [enrolledQuery.isSuccess, enrolledQuery.data?.message])

  useEffect(() => {
    if (enrolledQuery.isError) toast.error(enrolledQuery.error.message)
  }, [enrolledQuery.isError, enrolledQuery.error?.message])

  useEffect(() => {
    if (submissionsQuery.isError) toast.error(submissionsQuery.error.message)
  }, [submissionsQuery.isError, submissionsQuery.error?.message])

  const submissionAssignmentIds = new Set((submissionsQuery.data?.data ?? []).map((item) => item.assignment.id))
  const accentStyles = [
    {
      bannerClassName: 'bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100',
      progressClassName: 'bg-blue-500',
    },
    {
      bannerClassName: 'bg-gradient-to-br from-violet-50 via-white to-fuchsia-100',
      progressClassName: 'bg-violet-500',
    },
    {
      bannerClassName: 'bg-gradient-to-br from-emerald-50 via-cyan-50 to-lime-100',
      progressClassName: 'bg-slate-900',
    },
    {
      bannerClassName: 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100',
      progressClassName: 'bg-amber-500',
    },
  ]

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My Courses</h1>
        <p className="mt-1 text-sm text-muted-foreground">Continue your learning journey and track your progress.</p>
      </div>

      {enrolledQuery.isLoading || submissionsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading enrolled courses...</p> : null}
      {enrolledQuery.isError ? <p className="text-sm text-destructive">{enrolledQuery.error.message}</p> : null}
      {!enrolledQuery.isError && submissionsQuery.isError ? (
        <p className="text-sm text-destructive">{submissionsQuery.error.message}</p>
      ) : null}
      {enrolledQuery.isSuccess && enrolledQuery.data.data.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">No enrolled courses found.</CardContent>
        </Card>
      ) : null}

      {enrolledQuery.isSuccess ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {enrolledQuery.data.data.map((course, index) => {
            const accentStyle = accentStyles[index % accentStyles.length]
            const completedChapters = course.chapters.filter(
              (chapter) => chapter.assignmentId && submissionAssignmentIds.has(chapter.assignmentId),
            ).length
            const totalChapters = course.chapters.length
            const progress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0

            return (
              <Card key={course.id} className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
                <div className={`h-20 border-b ${accentStyle.bannerClassName}`} />

                <CardContent className="space-y-4 pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold leading-snug text-slate-900">{course.name}</h2>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{course.description}</p>
                    </div>
                    <Badge variant={course.isPublished ? 'default' : 'outline'}>
                      {course.isPublished ? 'Published' : 'Active'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" />
                      Teacher: {course.teacher.username}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      Chapters: {course.chapters.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="h-2 rounded-full bg-slate-200">
                      <div className={`h-2 rounded-full ${accentStyle.progressClassName}`} style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {completedChapters} of {totalChapters} chapters completed
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1" size="sm" asChild>
                      <Link to="/student-courses/$courseId" params={{ courseId: course.id }}>
                        Continue Learning
                      </Link>
                    </Button>
                    <Button variant="outline" className="flex-1" size="sm" asChild>
                      <Link to="/assignments" search={{ courseId: course.id }}>
                        Assignments
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Compass className="h-5 w-5" />
        </div>
        <p className="mt-4 text-base font-medium text-slate-900">Explore More Courses</p>
        <p className="mt-2 text-sm text-slate-500">Discover additional courses and continue expanding your learning path.</p>
        <Button variant="outline" className="mt-5" asChild>
          <Link to="/student-courses/all">Browse All Courses</Link>
        </Button>
      </div>
    </section>
  )
}
