import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { Plus, Upload } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createCourse,
  getTeachingCourses,
  type CourseItem,
} from '@/lib/courses-api'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/teacher/courses/')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'teacher') {
      throw redirect({ to: `/${role}` as '/student' | '/admin' })
    }
  },
  component: TeacherCoursesPage,
})

function TeacherCoursesPage() {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()
  const [openCreateCourse, setOpenCreateCourse] = useState(false)
  const [courseName, setCourseName] = useState('')
  const [courseDescription, setCourseDescription] = useState('')

  const coursesQuery = useQuery<{ message: string; data: CourseItem[] }, Error>({
    queryKey: ['teacher-courses', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getTeachingCourses(accessToken!),
  })

  const createCourseMutation = useMutation({
    mutationFn: async () => createCourse(accessToken!, { name: courseName, description: courseDescription }),
    onSuccess: async (result) => {
      toast.success(result.message)
      setCourseName('')
      setCourseDescription('')
      setOpenCreateCourse(false)
      await queryClient.invalidateQueries({ queryKey: ['teacher-courses'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Create course failed'),
  })

  const onCreateCourse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createCourseMutation.mutate()
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Courses</h1>
          <p className="text-sm text-muted-foreground">Manage and organize your teaching content.</p>
        </div>

        <Dialog open={openCreateCourse} onOpenChange={setOpenCreateCourse}>
          <DialogTrigger asChild>
            <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-900">
              <Plus className="h-4 w-4" />
              Create Course
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Course</DialogTitle>
              <DialogDescription>Create a new teaching course.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={onCreateCourse}>
              <div className="space-y-2">
                <Label htmlFor="course-name">Course name</Label>
                <Input
                  id="course-name"
                  value={courseName}
                  onChange={(event) => setCourseName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-description">Description</Label>
                <textarea
                  id="course-description"
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={courseDescription}
                  onChange={(event) => setCourseDescription(event.target.value)}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createCourseMutation.isPending || !accessToken}>
                  {createCourseMutation.isPending ? 'Creating...' : 'Create course'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {coursesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading courses...</p> : null}
      {coursesQuery.isError ? <p className="text-sm text-destructive">{coursesQuery.error.message}</p> : null}
      {coursesQuery.isSuccess && coursesQuery.data.data.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">No courses found.</CardContent>
        </Card>
      ) : null}

      {coursesQuery.isSuccess ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {coursesQuery.data.data.map((course) => {
            const assignmentCount = course.chapters.filter((chapter) => chapter.assignmentId).length

            return (
              <Card key={course.id} className="h-full rounded-2xl border-slate-200 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="mb-4 flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                      <Upload className="h-5 w-5 rotate-180" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-xl font-semibold leading-tight text-slate-900">{course.name}</p>
                        <Badge
                          className={
                            course.isPublished
                              ? 'shrink-0 border-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-50'
                              : 'shrink-0 border-0 bg-slate-100 text-slate-500 hover:bg-slate-100'
                          }
                        >
                          {course.isPublished ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{course.description}</p>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                      <span>{course.chapters.length} lessons</span>
                      <span>•</span>
                      <span>{assignmentCount} assignments</span>
                    </div>
                  </div>

                  <Link
                    to="/teacher/courses/$courseId"
                    params={{ courseId: course.id }}
                    className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-900"
                  >
                    Manage Course
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
