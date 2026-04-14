import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { getTeachingCourses, type CourseItem } from '@/lib/courses-api'
import {
  exportStatisticsPdf,
  getStatisticsOverview,
  getStatisticsVisualization,
  type StatisticsBucket,
  type StatisticsOverview,
  type StatisticsVisualization,
} from '@/lib/statistics-reporting-api'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/teacher')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'teacher') {
      throw redirect({ to: `/${role}` as '/student' | '/admin' })
    }
  },
  component: TeacherPage,
})

function TeacherPage() {
  const { accessToken } = useAuth()
  const [selectedCourseId, setSelectedCourseId] = useState('')

  const coursesQuery = useQuery<{ message: string; data: CourseItem[] }, Error>({
    queryKey: ['teacher-courses', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getTeachingCourses(accessToken!),
  })

  useEffect(() => {
    if (!selectedCourseId && coursesQuery.data?.data.length) {
      setSelectedCourseId(coursesQuery.data.data[0].id)
    }
  }, [coursesQuery.data?.data, selectedCourseId])

  const selectedCourse = coursesQuery.data?.data.find((course) => course.id === selectedCourseId) ?? null

  const overviewQuery = useQuery<{ message: string; data: StatisticsOverview }, Error>({
    queryKey: ['teacher-statistics-overview', accessToken, selectedCourseId],
    enabled: Boolean(accessToken && selectedCourseId),
    queryFn: async () => getStatisticsOverview(accessToken!, selectedCourseId),
  })

  const visualizationQuery = useQuery<{ message: string; data: StatisticsVisualization }, Error>({
    queryKey: ['teacher-statistics-visualization', accessToken, selectedCourseId],
    enabled: Boolean(accessToken && selectedCourseId),
    queryFn: async () => getStatisticsVisualization(accessToken!, selectedCourseId),
  })

  const exportPdfMutation = useMutation({
    mutationFn: async () => exportStatisticsPdf(accessToken!, selectedCourseId),
    onSuccess: ({ blob, filename }) => {
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = filename ?? `statistics-report-${selectedCourseId}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(objectUrl)
      toast.success('PDF report exported successfully')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Export PDF failed'),
  })

  const pieChartStyle = useMemo(() => {
    const buckets = visualizationQuery.data?.data.pieChart ?? overviewQuery.data?.data.plagiarismDistribution ?? []
    const total = buckets.reduce((sum, item) => sum + item.value, 0)
    if (total === 0 || buckets.length === 0) {
      return { background: 'conic-gradient(#e5e7eb 0 100%)' }
    }

    const colors = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6']
    let current = 0
    const segments = buckets.map((bucket, index) => {
      const next = current + (bucket.value / total) * 100
      const segment = `${colors[index % colors.length]} ${current}% ${next}%`
      current = next
      return segment
    })

    return { background: `conic-gradient(${segments.join(', ')})` }
  }, [overviewQuery.data?.data.plagiarismDistribution, visualizationQuery.data?.data.pieChart])

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Teacher Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground">Track suspicious plagiarism rate, submission completion, and export a PDF report.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="analytics-course">Course</Label>
            <select
              id="analytics-course"
              className="flex h-10 min-w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              disabled={coursesQuery.isLoading || coursesQuery.data?.data.length === 0}
            >
              {coursesQuery.data?.data.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            disabled={!selectedCourseId || exportPdfMutation.isPending}
            onClick={() => exportPdfMutation.mutate()}
          >
            {exportPdfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export PDF
          </Button>
        </div>
      </div>

      {coursesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading teaching courses...</p> : null}
      {coursesQuery.isError ? <p className="text-sm text-destructive">{coursesQuery.error.message}</p> : null}
      {coursesQuery.isSuccess && coursesQuery.data.data.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">No teaching courses found for analytics.</CardContent>
        </Card>
      ) : null}

      {selectedCourse ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{selectedCourse.name}</CardTitle>
                <CardDescription>{selectedCourse.description}</CardDescription>
              </div>
              <Badge variant={selectedCourse.isPublished ? 'default' : 'outline'}>
                {selectedCourse.isPublished ? 'published' : 'draft'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-muted-foreground">Teacher</p>
              <p className="font-medium">{selectedCourse.teacher.username}</p>
            </div>
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-muted-foreground">Chapters</p>
              <p className="font-medium">{selectedCourse.chapters.length}</p>
            </div>
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-muted-foreground">Course ID</p>
              <p className="truncate font-medium">{selectedCourse.id}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {selectedCourseId ? (
        <>
          {overviewQuery.isLoading || visualizationQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading analytics...</p>
          ) : null}
          {overviewQuery.isError ? <p className="text-sm text-destructive">{overviewQuery.error.message}</p> : null}
          {visualizationQuery.isError ? <p className="text-sm text-destructive">{visualizationQuery.error.message}</p> : null}

          {overviewQuery.data && visualizationQuery.data ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total Courses" value={overviewQuery.data.data.totalCourses} helper="In this report scope" />
                <MetricCard label="Total Assignments" value={overviewQuery.data.data.totalAssignments} helper="Assignments in the course" />
                <MetricCard label="Total Submissions" value={overviewQuery.data.data.totalSubmissions} helper="All received submissions" />
                <MetricCard
                  label="Suspicious Rate"
                  value={`${overviewQuery.data.data.suspiciousRate.toFixed(2)}%`}
                  helper="Potential plagiarism rate"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Submission Volume</CardTitle>
                    <CardDescription>Bar chart from visualization data.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BarChartPanel data={visualizationQuery.data.data.barChart} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Plagiarism Distribution</CardTitle>
                    <CardDescription>Pie breakdown by suspicion level.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full" style={pieChartStyle}>
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background text-center text-xs font-medium">
                        {overviewQuery.data.data.suspiciousRate.toFixed(2)}%
                      </div>
                    </div>
                    <DistributionLegend data={visualizationQuery.data.data.pieChart} />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Submission Trend</CardTitle>
                    <CardDescription>Trend chart by date.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TrendChartPanel data={visualizationQuery.data.data.trendChart} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Completion Snapshot</CardTitle>
                    <CardDescription>Current submission completion overview.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="text-muted-foreground">Submitted</p>
                      <p className="text-xl font-semibold">{overviewQuery.data.data.submissionCompletion.submitted}</p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="text-muted-foreground">Expected Assignments</p>
                      <p className="text-xl font-semibold">{overviewQuery.data.data.submissionCompletion.expectedAssignments}</p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="text-muted-foreground">Completion Rate</p>
                      <p className="text-xl font-semibold">{overviewQuery.data.data.submissionCompletion.completionRate.toFixed(2)}%</p>
                    </div>
                    <DistributionLegend data={overviewQuery.data.data.plagiarismDistribution} />
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function MetricCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

function DistributionLegend({ data }: { data: StatisticsBucket[] }) {
  const colors = ['bg-green-500', 'bg-amber-500', 'bg-red-500', 'bg-blue-500', 'bg-violet-500']

  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${colors[index % colors.length]}`} />
            <span>{item.label}</span>
          </div>
          <span className="font-medium">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function BarChartPanel({ data }: { data: StatisticsVisualization['barChart'] }) {
  const maxValue = Math.max(...data.map((item) => item.submissionCount), 1)

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.courseId} className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{item.courseName}</span>
            <span className="text-muted-foreground">{item.submissionCount} submissions</span>
          </div>
          <div className="h-3 rounded-full bg-muted">
            <div
              className="h-3 rounded-full bg-primary transition-all"
              style={{ width: `${Math.max((item.submissionCount / maxValue) * 100, 6)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function TrendChartPanel({ data }: { data: StatisticsVisualization['trendChart'] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No trend data available.</p>
  }

  if (data.length === 1) {
    return (
      <div className="rounded-md border p-4 text-sm">
        <p className="font-medium">{data[0].date}</p>
        <p className="text-muted-foreground">{data[0].submissionCount} submissions</p>
      </div>
    )
  }

  const width = 520
  const height = 220
  const padding = 24
  const maxValue = Math.max(...data.map((item) => item.submissionCount), 1)
  const points = data
    .map((item, index) => {
      const x = padding + (index * (width - padding * 2)) / (data.length - 1)
      const y = height - padding - (item.submissionCount / maxValue) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full overflow-visible rounded-md border bg-background">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" opacity="0.2" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" opacity="0.2" />
        <polyline fill="none" stroke="currentColor" strokeWidth="3" points={points} className="text-primary" />
        {data.map((item, index) => {
          const x = padding + (index * (width - padding * 2)) / (data.length - 1)
          const y = height - padding - (item.submissionCount / maxValue) * (height - padding * 2)
          return <circle key={`${item.date}-${index}`} cx={x} cy={y} r="4" fill="currentColor" className="text-primary" />
        })}
      </svg>
      <div className="grid gap-2 md:grid-cols-3">
        {data.map((item) => (
          <div key={item.date} className="rounded-md border p-3 text-sm">
            <p className="font-medium">{item.date}</p>
            <p className="text-muted-foreground">{item.submissionCount} submissions</p>
          </div>
        ))}
      </div>
    </div>
  )
}
