import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BookOpen, ChevronDown, Search, UserRound } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getAllCourses, type CourseItem } from '@/lib/courses-api'
import { useAuth } from '@/modules/auth/auth-context'

const TEACHER_FILTERS = [
  { id: '', label: 'All Teachers' },
  { id: '00000000-0000-4000-8000-000000000002', label: 'teacher1' },
  { id: '00000000-0000-4000-8000-000000000003', label: 'teacher2' },
]

export const Route = createFileRoute('/_authenticated/student-courses/all')({
  component: StudentAllCoursesPage,
})

function StudentAllCoursesPage() {
  const { accessToken } = useAuth()
  const [teacherIdFilter, setTeacherIdFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const allCoursesQuery = useQuery<{ message: string; data: CourseItem[] }, Error>({
    queryKey: ['student-all-courses', accessToken, teacherIdFilter],
    enabled: Boolean(accessToken),
    queryFn: async () => getAllCourses(accessToken!, teacherIdFilter || undefined),
  })

  useEffect(() => {
    if (allCoursesQuery.isError) toast.error(allCoursesQuery.error.message)
  }, [allCoursesQuery.isError, allCoursesQuery.error?.message])

  const selectedFilterLabel = useMemo(
    () => TEACHER_FILTERS.find((item) => item.id === teacherIdFilter)?.label ?? 'All Teachers',
    [teacherIdFilter],
  )

  const filteredCourses = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    const courses = allCoursesQuery.data?.data ?? []

    if (!keyword) {
      return courses
    }

    return courses.filter((course) => {
      const haystack = [course.name, course.description, course.teacher.username].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [allCoursesQuery.data?.data, searchTerm])

  const accentStyles = [
    'bg-gradient-to-br from-indigo-500 via-indigo-400 to-violet-500',
    'bg-gradient-to-br from-fuchsia-400 via-pink-400 to-rose-500',
    'bg-gradient-to-br from-sky-400 via-cyan-400 to-blue-400',
    'bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400',
    'bg-gradient-to-br from-rose-400 via-orange-300 to-amber-300',
    'bg-gradient-to-br from-cyan-400 via-sky-500 to-indigo-800',
    'bg-gradient-to-br from-cyan-100 via-slate-100 to-pink-100',
    'bg-gradient-to-br from-rose-200 via-pink-200 to-fuchsia-200',
  ]

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Course Catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">Explore our comprehensive collection of courses and start learning today.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search courses..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15"
            />
          </div>

          <div className="relative lg:w-48">
            <select
              value={teacherIdFilter}
              onChange={(event) => setTeacherIdFilter(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15"
            >
              {TEACHER_FILTERS.map((teacher) => (
                <option key={teacher.id || 'all'} value={teacher.id}>
                  {teacher.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {allCoursesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading courses...</p> : null}
        {allCoursesQuery.isError ? <p className="text-sm text-destructive">{allCoursesQuery.error.message}</p> : null}
        {allCoursesQuery.isSuccess && filteredCourses.length === 0 ? (
          <Card className="rounded-2xl border-dashed lg:col-span-2 xl:col-span-4">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No courses found for the current search and teacher filter.
            </CardContent>
          </Card>
        ) : null}

        {allCoursesQuery.isSuccess
            ? filteredCourses.map((course, index) => (
              <Card key={course.id} className="h-full overflow-hidden rounded-2xl border-slate-200 shadow-sm">
                <div className={`relative h-24 ${accentStyles[index % accentStyles.length]}`}>
                  <Badge className="absolute right-3 top-3 border-0 bg-white/95 text-slate-600 shadow-none hover:bg-white/95">
                    {course.isPublished ? 'Published' : 'New'}
                  </Badge>
                </div>

                <CardContent className="flex h-[260px] flex-col pt-5">
                  <div className="min-h-[120px]">
                    <h2 className="line-clamp-2 text-[1.35rem] font-semibold leading-tight text-slate-900">{course.name}</h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{course.description}</p>
                  </div>

                  <div className="grid min-h-[56px] grid-cols-2 gap-3 text-xs text-slate-500">
                    <div className="space-y-1">
                      <p className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5" />
                        Teacher:
                      </p>
                      <p className="font-medium text-slate-700">{course.teacher.username}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="inline-flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        Chapters
                      </p>
                      <p className="font-medium text-slate-700">{course.chapters.length}</p>
                    </div>
                  </div>

                  <Button className="mt-auto w-full" asChild>
                    <Link to="/student-courses/$courseId" params={{ courseId: course.id }}>
                      View Details & Enroll
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          : null}
      </div>

      <p className="text-sm text-muted-foreground">Filter applied: <span className="font-medium text-slate-700">{selectedFilterLabel}</span></p>
    </section>
  )
}
