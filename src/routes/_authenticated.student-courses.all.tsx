import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAllCourses, type CourseItem } from '@/lib/courses-api'
import { useAuth } from '@/modules/auth/auth-context'

const TEACHER_FILTERS = [
  { id: '', label: 'All teachers' },
  { id: '99b59d8a-3983-4664-9446-0f51801c48b2', label: 'teacher1' },
  { id: 'f3b5f2fe-6c48-4f98-b6d6-aab4790d6523', label: 'teacher2' },
]

export const Route = createFileRoute('/_authenticated/student-courses/all')({
  component: StudentAllCoursesPage,
})

function StudentAllCoursesPage() {
  const { accessToken } = useAuth()
  const navigate = useNavigate()
  const [teacherIdFilter, setTeacherIdFilter] = useState('')

  const allCoursesQuery = useQuery<{ message: string; data: CourseItem[] }, Error>({
    queryKey: ['student-all-courses', accessToken, teacherIdFilter],
    enabled: Boolean(accessToken),
    queryFn: async () => getAllCourses(accessToken!, teacherIdFilter || undefined),
  })

  useEffect(() => {
    if (allCoursesQuery.isError) toast.error(allCoursesQuery.error.message)
  }, [allCoursesQuery.isError, allCoursesQuery.error?.message])

  const selectedFilterLabel = useMemo(
    () => TEACHER_FILTERS.find((item) => item.id === teacherIdFilter)?.label ?? 'All teachers',
    [teacherIdFilter],
  )

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">All Courses</h1>
        <p className="text-sm text-muted-foreground">Browse course catalog and open detail to enroll.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teacher Filter</CardTitle>
          <CardDescription>Quick filter by available teachers.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {TEACHER_FILTERS.map((teacher) => (
            <Button
              key={teacher.id || 'all'}
              type="button"
              variant={teacherIdFilter === teacher.id ? 'default' : 'outline'}
              onClick={() => setTeacherIdFilter(teacher.id)}
            >
              {teacher.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Course Catalog</CardTitle>
          <CardDescription>Courses in the system (filter: {selectedFilterLabel}).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {allCoursesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading courses...</p> : null}
          {allCoursesQuery.isError ? <p className="text-sm text-destructive">{allCoursesQuery.error.message}</p> : null}
          {allCoursesQuery.isSuccess && allCoursesQuery.data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No courses found.</p>
          ) : null}

          {allCoursesQuery.isSuccess
            ? allCoursesQuery.data.data.map((course) => (
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
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate({ to: '/student-courses/$courseId', params: { courseId: course.id } })}
                    >
                      View details
                    </Button>
                  </div>
                </div>
              ))
            : null}
        </CardContent>
      </Card>
    </section>
  )
}
