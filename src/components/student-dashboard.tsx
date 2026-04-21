import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCode2,
  GraduationCap,
  Sparkles,
  Trophy,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getMyCourseAssignments, type AssignmentItem } from '@/lib/assignments-api'
import { getEnrolledCourses, type CourseItem } from '@/lib/courses-api'
import { getStudentSubmissions, type SubmissionItem } from '@/lib/submissions-api'
import { useAuth } from '@/modules/auth/auth-context'

type CourseAssignmentsMap = Record<string, AssignmentItem[]>

function getInitials(username: string) {
  return username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRelativeDeadline(value: string) {
  const now = Date.now()
  const deadline = new Date(value).getTime()
  const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} overdue`
  }

  if (diffDays === 0) {
    return 'Due today'
  }

  return `${diffDays} day${diffDays === 1 ? '' : 's'} left`
}

function dedupeAssignments(assignments: AssignmentItem[]) {
  const map = new Map<string, AssignmentItem>()
  assignments.forEach((assignment) => {
    map.set(assignment.id, assignment)
  })
  return Array.from(map.values())
}

function ProgressBar({ value, colorClassName }: { value: number; colorClassName: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-200">
      <div className={`h-2 rounded-full ${colorClassName}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  )
}

export function StudentDashboard() {
  const { accessToken, user } = useAuth()

  const enrolledCoursesQuery = useQuery<{ message: string; data: CourseItem[] }, Error>({
    queryKey: ['student-dashboard-enrolled-courses', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getEnrolledCourses(accessToken!),
  })

  const submissionsQuery = useQuery<{ message: string; data: SubmissionItem[] }, Error>({
    queryKey: ['student-dashboard-submissions', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getStudentSubmissions(accessToken!),
  })

  const enrolledCourses = enrolledCoursesQuery.data?.data ?? []
  const assignmentQueries = useQueries({
    queries: enrolledCourses.map((course) => ({
      queryKey: ['student-dashboard-course-assignments', accessToken, course.id],
      enabled: Boolean(accessToken),
      queryFn: async () => getMyCourseAssignments(accessToken!, course.id),
    })),
  })

  const isLoadingAssignments = enrolledCoursesQuery.isLoading || submissionsQuery.isLoading || assignmentQueries.some((query) => query.isLoading)
  const baseError = enrolledCoursesQuery.error ?? submissionsQuery.error
  const assignmentsError = assignmentQueries.find((query) => query.isError)?.error
  const error = baseError ?? assignmentsError ?? null

  const courseAssignments = useMemo<CourseAssignmentsMap>(() => {
    const entries: CourseAssignmentsMap = {}

    enrolledCourses.forEach((course, index) => {
      const data = assignmentQueries[index]?.data?.data ?? []
      entries[course.id] = data.map((assignment) => ({
        ...assignment,
        chapter: assignment.chapter
          ? {
              ...assignment.chapter,
              course: assignment.chapter.course ?? { id: course.id, name: course.name },
            }
          : undefined,
      }))
    })

    return entries
  }, [assignmentQueries, enrolledCourses])

  const submissions = submissionsQuery.data?.data ?? []

  const derived = useMemo(() => {
    const allAssignments = dedupeAssignments(Object.values(courseAssignments).flat())
    const openAssignments = allAssignments
      .filter((assignment) => assignment.status === 'open')
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())

    const submissionByAssignment = new Set(submissions.map((item) => item.assignment.id))
    const gradedSubmissions = submissions.filter((item) => typeof item.score === 'number')
    const averageScore = gradedSubmissions.length
      ? Math.round(gradedSubmissions.reduce((sum, item) => sum + (item.score ?? 0), 0) / gradedSubmissions.length)
      : null

    const latestSubmissions = [...submissions].sort((a, b) => {
      const left = new Date(a.lastSubmittedAt ?? a.created_at).getTime()
      const right = new Date(b.lastSubmittedAt ?? b.created_at).getTime()
      return right - left
    })

    const coursesWithProgress = enrolledCourses.map((course) => {
      const assignments = courseAssignments[course.id] ?? []
      const uniqueAssignments = dedupeAssignments(assignments)
      const submittedCount = uniqueAssignments.filter((assignment) => submissionByAssignment.has(assignment.id)).length
      const totalAssignments = uniqueAssignments.length
      const progress = totalAssignments > 0 ? Math.round((submittedCount / totalAssignments) * 100) : 0

      return {
        ...course,
        totalAssignments,
        submittedCount,
        progress,
      }
    })

    return {
      allAssignments,
      openAssignments,
      averageScore,
      latestSubmissions,
      coursesWithProgress,
    }
  }, [courseAssignments, enrolledCourses, submissions])

  if (isLoadingAssignments) {
    return <p className="text-sm text-muted-foreground">Loading student dashboard...</p>
  }

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>
  }

  if (!user) {
    return null
  }

  const overviewCards = [
    {
      label: 'Enrolled Courses',
      value: formatNumber(enrolledCourses.length),
      helper: 'Courses you can access now',
      icon: GraduationCap,
    },
    {
      label: 'Open Assignments',
      value: formatNumber(derived.openAssignments.length),
      helper: 'Tasks that still accept submissions',
      icon: FileCode2,
    },
    {
      label: 'Completed Submissions',
      value: formatNumber(submissions.length),
      helper: averageScoreLabel(derived.averageScore),
      icon: CheckCircle2,
    },
  ]

  const accentColors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500']

  return (
    <section className="space-y-8">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 p-6 text-white shadow-[0_20px_70px_rgba(37,99,235,0.28)] md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-xl font-semibold text-blue-600 shadow-sm">
              {getInitials(user.username) || 'ST'}
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{user.username}</h1>
              <p className="mt-1 text-sm text-blue-100">Student Dashboard Overview</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-blue-50 backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            Track courses, assignments, and submissions in one place
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {overviewCards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm text-blue-100">
                  <Icon className="h-4 w-4" />
                  <span>{card.label}</span>
                </div>
                <p className="mt-2 text-3xl font-semibold">{card.value}</p>
                <p className="mt-1 text-xs text-blue-100/85">{card.helper}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">My Courses</h2>
          <p className="mt-1 text-sm text-slate-500">Review your enrolled courses and jump directly to course details or assignments.</p>
        </div>

        {derived.coursesWithProgress.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">You have not enrolled in any courses yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {derived.coursesWithProgress.slice(0, 3).map((course, index) => (
              <Card key={course.id} className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${accentColors[index % accentColors.length]}`}>
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <Badge variant={course.isPublished ? 'default' : 'outline'}>{course.isPublished ? 'Published' : 'Draft'}</Badge>
                  </div>
                  <div>
                    <CardTitle className="text-xl leading-snug">{course.name}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">{course.teacher.username}</CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3 text-slate-500">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Chapters</p>
                      <p className="mt-1 font-semibold text-slate-900">{course.chapters.length}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Assignments</p>
                      <p className="mt-1 font-semibold text-slate-900">{course.totalAssignments}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Submission Progress</span>
                      <span className="font-medium text-slate-700">{course.progress}%</span>
                    </div>
                    <ProgressBar value={course.progress} colorClassName={accentColors[index % accentColors.length]} />
                    <p className="text-xs text-slate-500">
                      {course.submittedCount}/{course.totalAssignments} assignments submitted
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link to="/student-courses/$courseId" params={{ courseId: course.id }}>
                        View course
                      </Link>
                    </Button>
                    <Button size="sm" className="flex-1" asChild>
                      <Link to="/assignments" search={{ courseId: course.id }}>
                        Assignments
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Action Required</h2>
          <p className="mt-1 text-sm text-slate-500">Prioritize the upcoming assignments that still accept submissions.</p>
        </div>

        {derived.openAssignments.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">No open assignments at the moment.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {derived.openAssignments.slice(0, 4).map((assignment) => (
              <Card key={assignment.id} className="rounded-2xl border-slate-200 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-slate-900">{assignment.title}</h3>
                      <p className="text-sm text-slate-500">{assignment.chapter?.course?.name ?? 'Enrolled course'}</p>
                    </div>
                    <Badge>{assignment.status}</Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="h-4 w-4" />
                      {formatDate(assignment.deadline)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-4 w-4" />
                      {formatRelativeDeadline(assignment.deadline)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Trophy className="h-4 w-4" />
                      {assignment.maxScore ?? 100} pts
                    </span>
                  </div>

                  <p className="mt-4 line-clamp-2 text-sm text-slate-600">{assignment.description}</p>

                  <Button className="mt-5 w-full" asChild>
                    <Link
                      to="/assignments/$assignmentId"
                      params={{ assignmentId: assignment.id }}
                      search={{ courseId: assignment.chapter?.course?.id }}
                    >
                      View Assignment
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Recent Submissions</h2>
          <p className="mt-1 text-sm text-slate-500">Keep track of your latest submission status, score, and evaluation progress.</p>
        </div>

        {derived.latestSubmissions.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">No submissions yet.</CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="grid grid-cols-[2fr_1.2fr_1.2fr_0.9fr_0.9fr] gap-4 border-b bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Assignment</span>
                <span>Course</span>
                <span>Submitted</span>
                <span>Status</span>
                <span>Score</span>
              </div>

              {derived.latestSubmissions.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[2fr_1.2fr_1.2fr_0.9fr_0.9fr] gap-4 border-b px-6 py-4 text-sm last:border-b-0"
                >
                  <div>
                    <p className="font-medium text-slate-900">{item.assignment.title}</p>
                    <p className="text-xs text-slate-500">{item.language}</p>
                  </div>
                  <div className="text-slate-600">{findCourseNameForSubmission(item, courseAssignments)}</div>
                  <div className="text-slate-600">{formatDate(item.lastSubmittedAt ?? item.created_at)}</div>
                  <div>
                    <Badge variant={item.judgeStatus === 'completed' ? 'default' : 'outline'}>{item.status}</Badge>
                  </div>
                  <div className="font-medium text-slate-900">{item.score ?? 'Pending'}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}

function averageScoreLabel(value: number | null) {
  if (value === null) {
    return 'No graded submissions yet'
  }

  return `Average score ${value}/100`
}

function findCourseNameForSubmission(item: SubmissionItem, courseAssignments: CourseAssignmentsMap) {
  for (const assignments of Object.values(courseAssignments)) {
    const matched = assignments.find((assignment) => assignment.id === item.assignment.id)
    if (matched?.chapter?.course?.name) {
      return matched.chapter.course.name
    }
  }

  return 'Course unavailable'
}
