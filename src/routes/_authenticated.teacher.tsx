import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Outlet, createFileRoute, redirect, useLocation } from '@tanstack/react-router'
import { AlertTriangle, BookOpen, ClipboardList, Download, Loader2, ShieldAlert } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getTeachingCourses, type CourseItem } from '@/lib/courses-api'
import { getHighRiskSubmissions, type HighRiskSubmission } from '@/lib/review-verdict-api'
import {
  exportStatisticsPdf,
  getStatisticsOverview,
  getSubmissionTrends,
  getStatisticsVisualization,
  type SubmissionTrends,
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
  component: TeacherRoute,
})

function TeacherRoute() {
  const location = useLocation()

  if (location.pathname !== '/teacher' && location.pathname !== '/teacher/') {
    return <Outlet />
  }

  return <TeacherPage />
}

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

  const submissionTrendsQuery = useQuery<{ message: string; data: SubmissionTrends }, Error>({
    queryKey: ['teacher-submission-trends', accessToken, selectedCourseId, 30],
    enabled: Boolean(accessToken && selectedCourseId),
    queryFn: async () => getSubmissionTrends(accessToken!, selectedCourseId, 30),
  })

  const highRiskQuery = useQuery<{ message: string; data: HighRiskSubmission[] }, Error>({
    queryKey: ['teacher-analytics-high-risk', accessToken, selectedCourseId],
    enabled: Boolean(accessToken && selectedCourseId),
    queryFn: async () => getHighRiskSubmissions(accessToken!, selectedCourseId),
  })

  const exportPdfMutation = useMutation({
    mutationFn: async () => exportStatisticsPdf(accessToken!, selectedCourseId),
    onSuccess: ({ downloadUrl, filename, objectUrl, report }) => {
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = filename ?? `statistics-report-${selectedCourseId}.pdf`
      anchor.target = '_blank'
      anchor.rel = 'noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)

      if (objectUrl) {
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
      }

      toast.success(report?.fileName ? `PDF report exported: ${report.fileName}` : 'PDF report exported successfully')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Export PDF failed'),
  })

  const isLoadingAnalytics =
    overviewQuery.isLoading || visualizationQuery.isLoading || submissionTrendsQuery.isLoading || highRiskQuery.isLoading
  const analyticsError = overviewQuery.error ?? visualizationQuery.error ?? submissionTrendsQuery.error ?? highRiskQuery.error ?? null
  const topSuspicious = [...(highRiskQuery.data?.data ?? [])]
    .sort((left, right) => right.highestSimilarity - left.highestSimilarity)
    .slice(0, 5)

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Teacher Analytics Command Center</h1>
          <p className="text-sm text-muted-foreground">Monitor submissions, detect plagiarism patterns, and track course performance.</p>
          {selectedCourse ? <p className="mt-2 text-sm text-slate-500">{selectedCourse.name}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="h-11 min-w-[280px] rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15"
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

          <Button
            variant="outline"
            className="h-11 rounded-xl border-slate-200"
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
        <Card className="rounded-2xl border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">No teaching courses found for analytics.</CardContent>
        </Card>
      ) : null}

      {selectedCourseId ? (
        <>
          {isLoadingAnalytics ? <p className="text-sm text-muted-foreground">Loading analytics...</p> : null}
          {analyticsError ? <p className="text-sm text-destructive">{analyticsError.message}</p> : null}

          {overviewQuery.data && visualizationQuery.data && submissionTrendsQuery.data ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <AnalyticsMetricCard
                  title="Total Assignments"
                  value={overviewQuery.data.data.totalAssignments}
                  helper={`${selectedCourse?.chapters.length ?? 0} chapters in scope`}
                  accent="+ active"
                  icon={<BookOpen className="h-4 w-4" />}
                />
                <AnalyticsMetricCard
                  title="Submissions Received"
                  value={submissionTrendsQuery.data.data.summary.totalSubmissions}
                  helper={`Avg ${submissionTrendsQuery.data.data.summary.averagePerDay.toFixed(2)}/day over ${submissionTrendsQuery.data.data.range.days} days`}
                  accent={`Peak ${submissionTrendsQuery.data.data.summary.peakSubmissionCount}`}
                  icon={<ClipboardList className="h-4 w-4" />}
                />
                <AnalyticsMetricCard
                  title="Avg. Similarity Rate"
                  value={`${overviewQuery.data.data.suspiciousRate.toFixed(1)}%`}
                  helper="Potential plagiarism risk"
                  accent={`${highRiskQuery.data?.data.length ?? 0} flagged`}
                  icon={<AlertTriangle className="h-4 w-4" />}
                  tone="danger"
                />
                <AnalyticsMetricCard
                  title="Pending Reviews"
                  value={highRiskQuery.data?.data.length ?? 0}
                  helper="High-risk submissions waiting"
                  accent={`${overviewQuery.data.data.submissionCompletion.submitted}/${overviewQuery.data.data.submissionCompletion.expectedAssignments}`}
                  icon={<ShieldAlert className="h-4 w-4" />}
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_360px]">
                <Card className="rounded-2xl border-slate-200 shadow-sm">
                  <CardContent className="p-5">
                    <div className="mb-5">
                      <h2 className="text-xl font-semibold text-slate-900">Submission Trends</h2>
                      <p className="text-sm text-slate-500">
                        {submissionTrendsQuery.data.data.range.from} to {submissionTrendsQuery.data.data.range.to} for the selected course.
                      </p>
                    </div>
                    <TrendChartPanel data={submissionTrendsQuery.data.data.points} />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-slate-200 shadow-sm">
                  <CardContent className="p-5">
                    <div className="mb-5 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-500" />
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900">Top Suspicious Submissions</h2>
                        <p className="text-sm text-slate-500">Highest similarity cases that need quick attention.</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {topSuspicious.length === 0 ? (
                        <p className="text-sm text-slate-500">No suspicious submissions found for this course.</p>
                      ) : (
                        topSuspicious.map((item) => (
                          <div key={item.submissionId} className="rounded-2xl border border-slate-200 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">{item.student}</p>
                                <p className="mt-1 truncate text-sm text-slate-500">{item.assignment}</p>
                              </div>
                              <Badge className="border-0 bg-rose-50 text-rose-600 hover:bg-rose-50">
                                {Math.round(item.highestSimilarity * 100)}%
                              </Badge>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3">
                              <Badge className={verdictBadgeClass(item.status)}>{verdictStatusLabel(item.status)}</Badge>
                              <span className="text-xs text-slate-400">Review in Verdict</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
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

function AnalyticsMetricCard({
  title,
  value,
  helper,
  accent,
  icon,
  tone = 'default',
}: {
  title: string
  value: string | number
  helper: string
  accent: string
  icon: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <Card className={`rounded-2xl border shadow-sm ${tone === 'danger' ? 'border-rose-200' : 'border-slate-200'}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone === 'danger' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'
              }`}
          >
            {icon}
          </div>
          <Badge
            className={`border-0 ${tone === 'danger' ? 'bg-rose-50 text-rose-500 hover:bg-rose-50' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-50'
              }`}
          >
            {accent}
          </Badge>
        </div>
        <p className="mt-5 text-sm text-slate-500">{title}</p>
        <p className={`mt-1 text-4xl font-semibold ${tone === 'danger' ? 'text-rose-500' : 'text-slate-900'}`}>{value}</p>
        <p className="mt-2 text-xs text-slate-400">{helper}</p>
      </CardContent>
    </Card>
  )
}

function TrendChartPanel({ data }: { data: StatisticsVisualization['trendChart'] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No trend data available.</p>
  }

  const width = 780
  const height = 280
  const paddingX = 40
  const paddingY = 28
  const maxValue = Math.max(...data.map((item) => item.submissionCount), 1)

  const points = data
    .map((item, index) => {
      const x = paddingX + (index * (width - paddingX * 2)) / Math.max(data.length - 1, 1)
      const y = height - paddingY - (item.submissionCount / maxValue) * (height - paddingY * 2)
      return { ...item, x, y }
    })

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = paddingY + step * (height - paddingY * 2)
            return (
              <line
                key={step}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
            )
          })}

          {points.map((point, index) => {
            // Only draw background vertical lines for shown labels or skip some
            if (index % 5 !== 0 && index !== 0 && index !== points.length - 1) return null
            return (
              <line
                key={`${point.date}-${index}`}
                x1={point.x}
                y1={paddingY}
                x2={point.x}
                y2={height - paddingY}
                stroke="#eef2ff"
                strokeDasharray="4 4"
              />
            )
          })}

          <polyline
            fill="none"
            stroke="#e0a100"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          />

          {points.map((point, index) => (
            <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="4" fill="#e0a100" className="transition-all hover:r-6">
              <title>{`${point.date}: ${point.submissionCount} submissions`}</title>
            </circle>
          ))}

          {points.map((point, index) => {
            // Show first, last, and every 5th label to avoid crowding
            const shouldShowLabel = index === 0 || index === points.length - 1 || index % 5 === 0
            if (!shouldShowLabel) return null

            return (
              <text
                key={`label-${point.date}-${index}`}
                x={point.x}
                y={height - 8}
                textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
                fontSize="10"
                fill="#94a3b8"
                className="font-medium"
              >
                {point.date}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function verdictStatusLabel(status: HighRiskSubmission['status']) {
  if (status === 'confirmed_copy') return 'Confirmed Copy'
  if (status === 'clean') return 'Clean'
  return 'Under Review'
}

function verdictBadgeClass(status: HighRiskSubmission['status']) {
  if (status === 'confirmed_copy') {
    return 'border-0 bg-rose-50 text-rose-600 hover:bg-rose-50'
  }

  if (status === 'clean') {
    return 'border-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-50'
  }

  return 'border-0 bg-amber-50 text-amber-600 hover:bg-amber-50'
}
