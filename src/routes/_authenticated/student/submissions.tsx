import { useQueries, useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import Editor from '@monaco-editor/react'
import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, ChevronDown, Clock3, Gauge, Search, ShieldAlert, Trophy } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { getMyCourseAssignments, type AssignmentItem } from '@/lib/assignments-api'
import { getEnrolledCourses } from '@/lib/courses-api'
import { getStudentSubmissions, type SubmissionItem } from '@/lib/submissions-api'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/student/submissions')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'student') {
      throw redirect({ to: `/${role}` as '/teacher' | '/admin' })
    }
  },
  component: SubmissionsPage,
})

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatRelativeTime(value: string) {
  const now = Date.now()
  const timestamp = new Date(value).getTime()
  const diffDays = Math.round((now - timestamp) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) {
    return 'Today'
  }

  if (diffDays === 1) {
    return '1 day ago'
  }

  return `${diffDays} days ago`
}

function formatLanguage(value: string) {
  const labels: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    java: 'Java',
    cpp: 'C++',
  }

  return labels[value.toLowerCase()] ?? value
}

function getSubmissionStatus(item: SubmissionItem) {
  if (item.plagiarismFlag) {
    return {
      label: 'Plagiarism Warning',
      className: 'border-0 bg-rose-50 text-rose-600 hover:bg-rose-50',
    }
  }

  if (typeof item.score === 'number') {
    return {
      label: 'Graded',
      className: 'border-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-50',
    }
  }

  return {
    label: 'Pending',
    className: 'border-0 bg-amber-50 text-amber-600 hover:bg-amber-50',
  }
}

function SubmissionsPage() {
  const { accessToken } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)

  const submissionsQuery = useQuery<{ message: string; data: SubmissionItem[] }, Error>({
    queryKey: ['submissions', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getStudentSubmissions(accessToken!),
  })
  const enrolledCoursesQuery = useQuery({
    queryKey: ['submission-course-map-enrolled-courses', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getEnrolledCourses(accessToken!),
  })

  const enrolledCourses = enrolledCoursesQuery.data?.data ?? []
  const assignmentQueries = useQueries({
    queries: enrolledCourses.map((course) => ({
      queryKey: ['submission-course-map-assignments', accessToken, course.id],
      enabled: Boolean(accessToken),
      queryFn: async () => getMyCourseAssignments(accessToken!, course.id),
    })),
  })

  useEffect(() => {
    if (submissionsQuery.isSuccess) {
      toast.success(submissionsQuery.data.message)
    }
  }, [submissionsQuery.isSuccess, submissionsQuery.data?.message])

  useEffect(() => {
    if (submissionsQuery.isError) {
      toast.error(submissionsQuery.error.message)
    }
  }, [submissionsQuery.isError, submissionsQuery.error?.message])

  useEffect(() => {
    if (enrolledCoursesQuery.isError) {
      toast.error(enrolledCoursesQuery.error.message)
    }
  }, [enrolledCoursesQuery.isError, enrolledCoursesQuery.error?.message])

  if (submissionsQuery.isLoading || enrolledCoursesQuery.isLoading || assignmentQueries.some((query) => query.isLoading)) {
    return <p className="text-sm text-muted-foreground">Loading submissions...</p>
  }

  if (submissionsQuery.isError) {
    return <p className="text-sm text-destructive">{submissionsQuery.error.message}</p>
  }

  if (enrolledCoursesQuery.isError) {
    return <p className="text-sm text-destructive">{enrolledCoursesQuery.error.message}</p>
  }

  const assignmentQueryError = assignmentQueries.find((query) => query.isError)?.error
  if (assignmentQueryError) {
    return <p className="text-sm text-destructive">{assignmentQueryError.message}</p>
  }

  const submissions = submissionsQuery.data?.data ?? []
  const assignmentCourseMap = new Map<string, { id: string; name: string }>()
  assignmentQueries.forEach((query) => {
    const assignments = query.data?.data ?? []
    assignments.forEach((assignment: AssignmentItem) => {
      if (assignment.chapter?.course) {
        assignmentCourseMap.set(assignment.id, assignment.chapter.course)
      }
    })
  })

  const rows = submissions.map((item) => {
    const course = assignmentCourseMap.get(item.assignment.id)
    return {
      item,
      courseName: course?.name ?? 'Unassigned course',
      courseId: course?.id ?? 'unknown',
      status: getSubmissionStatus(item),
      submittedAt: item.lastSubmittedAt ?? item.created_at,
    }
  })

  const courseOptions = [
    { id: 'all', label: 'All Courses' },
    ...Array.from(new Map(rows.map((row) => [row.courseId, row.courseName])).entries()).map(([id, name]) => ({
      id,
      label: name,
    })),
  ]

  const filteredRows = rows.filter((row) => {
    const keyword = searchTerm.trim().toLowerCase()
    const matchesSearch =
      keyword.length === 0 ||
      [row.item.assignment.title, row.courseName, formatLanguage(row.item.language), row.status.label].join(' ').toLowerCase().includes(keyword)

    const matchesCourse = courseFilter === 'all' || row.courseId === courseFilter
    const matchesStatus = statusFilter === 'all' || row.status.label === statusFilter

    return matchesSearch && matchesCourse && matchesStatus
  })

  const selectedSubmission = rows.find((row) => row.item.id === selectedSubmissionId)?.item ?? null

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">My Submissions</h1>
        <p className="text-sm text-muted-foreground">View and manage all your assignment submissions, grades, and feedback.</p>
      </div>

      {submissions.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">No submissions found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search assignments..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15"
              />
            </div>

            <div className="relative lg:w-48">
              <select
                value={courseFilter}
                onChange={(event) => setCourseFilter(event.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15"
              >
                {courseOptions.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <div className="relative lg:w-44">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15"
              >
                {['all', 'Graded', 'Pending', 'Plagiarism Warning'].map((status) => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'All Statuses' : status}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[2.3fr_1.25fr_0.9fr_1.1fr_0.8fr_0.95fr] gap-4 border-b bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Assignment</span>
              <span>Submitted</span>
              <span>Language</span>
              <span>Status</span>
              <span>Score</span>
              <span className="text-right">Action</span>
            </div>

            {filteredRows.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-500">No submissions match the current filters.</div>
            ) : (
              filteredRows.map((row) => (
                <div
                  key={row.item.id}
                  className="grid grid-cols-[2.3fr_1.25fr_0.9fr_1.1fr_0.8fr_0.95fr] gap-4 border-b px-5 py-4 text-sm last:border-b-0"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{row.item.assignment.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{row.courseName}</p>
                  </div>

                  <div className="text-slate-600">
                    <p className="font-medium">{formatDateTime(row.submittedAt)}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(row.submittedAt)}</p>
                  </div>

                  <div>
                    <Badge className="border-0 bg-blue-50 text-blue-600 hover:bg-blue-50">{formatLanguage(row.item.language)}</Badge>
                  </div>

                  <div>
                    <Badge className={row.status.className}>{row.status.label}</Badge>
                  </div>

                  <div className="font-semibold text-slate-700">
                    {typeof row.item.score === 'number' ? `${row.item.score}/100` : 'Pending'}
                  </div>

                  <div className="text-right">
                    <Button className="h-9 rounded-xl px-4" onClick={() => setSelectedSubmissionId(row.item.id)}>
                      View Details
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <Dialog open={Boolean(selectedSubmission)} onOpenChange={(open) => (!open ? setSelectedSubmissionId(null) : null)}>
        {selectedSubmission ? (
          <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto rounded-3xl border-slate-200 p-0">
            <div className="border-b border-slate-200 px-8 py-7">
              <h2 className="text-4xl font-semibold tracking-tight text-slate-900">{selectedSubmission.assignment.title}</h2>

              <div className="mt-5 flex flex-wrap gap-3">
                <Badge className="border-0 bg-blue-50 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50">
                  {formatLanguage(selectedSubmission.language)}
                </Badge>
                <Badge className={`${getSubmissionStatus(selectedSubmission).className} px-4 py-2 text-sm`}>
                  {getSubmissionStatus(selectedSubmission).label}
                </Badge>
              </div>
            </div>

            <div className="space-y-8 px-8 py-7">
              <div className="grid gap-4 rounded-3xl bg-slate-50 p-6 lg:grid-cols-3">
                <div className="space-y-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Submission</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500">
                      <CalendarClock className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Submitted</span>
                    </div>
                    <p className="text-3xl font-semibold text-slate-900">{formatDateTime(selectedSubmission.lastSubmittedAt ?? selectedSubmission.created_at)}</p>
                    <p className="text-sm text-slate-400">{formatRelativeTime(selectedSubmission.lastSubmittedAt ?? selectedSubmission.created_at)}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock3 className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Version</span>
                    </div>
                    <p className="text-2xl font-semibold text-slate-900">v{selectedSubmission.versionCount ?? 1}</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Grading</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Trophy className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Score</span>
                    </div>
                    <p className="text-5xl font-semibold text-slate-900">
                      {selectedSubmission.score ?? 0}
                      <span className="text-3xl text-slate-500">/100</span>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Gauge className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Pass Rate</span>
                    </div>
                    <p className="text-2xl font-semibold text-slate-900">{selectedSubmission.passRate ?? 0}%</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Integrity Alert</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-rose-500">
                      <ShieldAlert className="h-4 w-4" />
                      <span className="text-3xl font-semibold">
                        {selectedSubmission.plagiarismFlag ? 'Plagiarism Detected' : 'Integrity Check Passed'}
                      </span>
                    </div>
                    <p className={`text-sm ${selectedSubmission.plagiarismFlag ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {selectedSubmission.plagiarismFlag ? 'High similarity found' : 'No high similarity was found'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Similarity Score</span>
                    </div>
                    <p className={`text-5xl font-semibold ${selectedSubmission.plagiarismFlag ? 'text-rose-500' : 'text-slate-900'}`}>
                      {selectedSubmission.highestSimilarity !== null && selectedSubmission.highestSimilarity !== undefined
                        ? `${Math.round(selectedSubmission.highestSimilarity * 100)}%`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-3xl font-semibold tracking-tight text-slate-900">Submitted Code - v{selectedSubmission.versionCount ?? 1}</h3>
                    <p className="mt-1 text-sm text-slate-500">{selectedSubmission.assignment.description}</p>
                  </div>
                  <span className="text-2xl text-slate-500">{formatLanguage(selectedSubmission.language)}</span>
                </div>

                {selectedSubmission.code ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <Editor
                      height="360px"
                      language={selectedSubmission.language === 'cpp' ? 'cpp' : selectedSubmission.language}
                      theme="vs-dark"
                      value={selectedSubmission.code}
                      options={{ readOnly: true, minimap: { enabled: false }, fontSize: 14 }}
                    />
                  </div>
                ) : (
                  <Card className="rounded-2xl border-dashed">
                    <CardContent className="pt-6 text-sm text-muted-foreground">No inline code was submitted.</CardContent>
                  </Card>
                )}

                {selectedSubmission.file ? (
                  <a href={selectedSubmission.file} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-primary underline">
                    View submitted file
                  </a>
                ) : null}
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-slate-900">Latest Test Results</h3>
                {!selectedSubmission.latestTestResults || selectedSubmission.latestTestResults.length === 0 ? (
                  <Card className="rounded-2xl border-dashed">
                    <CardContent className="pt-6 text-sm text-muted-foreground">No test results available yet.</CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedSubmission.latestTestResults.map((result) => (
                      <div key={result.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge className={result.passed ? 'border-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-50' : 'border-0 bg-rose-50 text-rose-600 hover:bg-rose-50'}>
                            {result.passed ? 'Passed' : 'Failed'}
                          </Badge>
                          <span className="text-xs text-slate-500">Case #{result.testCase.orderIndex}</span>
                          <span className="text-xs text-slate-500">Weight {result.testCase.weight}</span>
                        </div>
                        <div className="space-y-1 text-slate-600">
                          <p><span className="font-medium text-slate-900">Input:</span> {result.testCase.input}</p>
                          <p><span className="font-medium text-slate-900">Expected:</span> {result.testCase.expectedOutput ?? '(hidden)'}</p>
                          <p><span className="font-medium text-slate-900">Actual:</span> {result.actualOutput ?? '(none)'}</p>
                          <p><span className="font-medium text-slate-900">Runtime:</span> {result.executionTimeMs ?? 0} ms</p>
                          {result.errorMessage ? <p className="text-rose-500"><span className="font-medium">Error:</span> {result.errorMessage}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  )
}
