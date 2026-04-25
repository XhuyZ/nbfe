import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AlertTriangle, ChevronDown, Eye, Gavel, History, LayoutDashboard, Loader2, Search } from 'lucide-react'
import { toast } from 'react-toastify'
import { Editor } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { getAllCourses, getTeachingCourses, type CourseItem } from '@/lib/courses-api'
import {
  getEvidenceChain,
  getHighRiskSubmissions,
  getReviewVerdictDetail,
  getSubmissionPlagiarismStats,
  updateReviewVerdict,
  type EvidenceChain,
  type HighRiskSubmission,
  type VerdictStatus,
} from '@/lib/review-verdict-api'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/teacher/review-verdict')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'teacher') {
      throw redirect({ to: `/${role}` as '/student' | '/admin' })
    }
  },
  component: ReviewVerdictPage,
})

type DetailTab = 'overview' | 'timeline' | 'verdict'

function ReviewVerdictPage() {
  const queryClient = useQueryClient()
  const { accessToken, user } = useAuth()
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('')
  const [openDetailDialog, setOpenDetailDialog] = useState(false)
  const [verdict, setVerdict] = useState<VerdictStatus>('need_more_review')
  const [note, setNote] = useState('')
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [queueSearch, setQueueSearch] = useState('')
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null)

  const coursesQuery = useQuery<{ message: string; data: CourseItem[] }, Error>({
    queryKey: ['review-courses', accessToken, user?.role],
    enabled: Boolean(accessToken && user?.role),
    queryFn: async () => {
      if (user?.role === 'admin') {
        return getAllCourses(accessToken!)
      }
      return getTeachingCourses(accessToken!)
    },
  })

  useEffect(() => {
    if (!selectedCourseId && coursesQuery.data?.data.length) {
      setSelectedCourseId(coursesQuery.data.data[0].id)
    }
  }, [coursesQuery.data?.data, selectedCourseId])

  const highRiskQuery = useQuery({
    queryKey: ['review-high-risk', accessToken, selectedCourseId],
    enabled: Boolean(accessToken && selectedCourseId),
    queryFn: async () => getHighRiskSubmissions(accessToken!, selectedCourseId),
  })

  const queueItems = useMemo(() => {
    const keyword = queueSearch.trim().toLowerCase()
    return [...(highRiskQuery.data?.data ?? [])]
      .sort((left, right) => right.highestSimilarity - left.highestSimilarity)
      .filter((item) => {
        if (!keyword) return true
        return [item.student, item.assignment, item.course, item.reviewNote ?? ''].join(' ').toLowerCase().includes(keyword)
      })
  }, [highRiskQuery.data?.data, queueSearch])

  useEffect(() => {
    if (!queueItems.length) {
      setSelectedSubmissionId('')
      setOpenDetailDialog(false)
      return
    }

    if (selectedSubmissionId && !queueItems.some((item) => item.submissionId === selectedSubmissionId)) {
      setSelectedSubmissionId('')
      setOpenDetailDialog(false)
    }
  }, [queueItems, selectedSubmissionId])

  const selectedSubmission = queueItems.find((item) => item.submissionId === selectedSubmissionId) ?? null

  const verdictDetailQuery = useQuery({
    queryKey: ['review-verdict-detail', accessToken, selectedSubmissionId],
    enabled: Boolean(accessToken && selectedSubmissionId && openDetailDialog),
    queryFn: async () => getReviewVerdictDetail(accessToken!, selectedSubmissionId),
  })

  const plagiarismStatsQuery = useQuery({
    queryKey: ['review-plagiarism-stats', accessToken, selectedSubmissionId],
    enabled: Boolean(accessToken && selectedSubmissionId && openDetailDialog),
    queryFn: async () => getSubmissionPlagiarismStats(accessToken!, selectedSubmissionId),
  })

  const evidenceChainQuery = useQuery({
    queryKey: ['review-evidence-chain', accessToken, selectedSubmissionId],
    enabled: Boolean(accessToken && selectedSubmissionId && openDetailDialog),
    queryFn: async () => getEvidenceChain(accessToken!, selectedSubmissionId),
  })

  useEffect(() => {
    const detail = verdictDetailQuery.data?.data
    if (detail) {
      setVerdict(detail.verdict)
      setNote(detail.note ?? '')
    }
  }, [verdictDetailQuery.data?.data])

  useEffect(() => {
    setExpandedEvidenceId(plagiarismStatsQuery.data?.data.matches[0]?.plagiarismId ?? null)
  }, [plagiarismStatsQuery.data?.data.matches, selectedSubmissionId])

  const updateVerdictMutation = useMutation({
    mutationFn: async () => updateReviewVerdict(accessToken!, selectedSubmissionId, { verdict, note }),
    onSuccess: async (result) => {
      toast.success(result.message)
      await queryClient.invalidateQueries({ queryKey: ['review-high-risk', accessToken, selectedCourseId] })
      await queryClient.invalidateQueries({ queryKey: ['review-verdict-detail', accessToken, selectedSubmissionId] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update verdict'),
  })

  const onOpenDetail = (submissionId: string, tab: DetailTab = 'overview') => {
    setSelectedSubmissionId(submissionId)
    setActiveTab(tab)
    setOpenDetailDialog(true)
  }

  const selectedCourseName = coursesQuery.data?.data.find((course) => course.id === selectedCourseId)?.name ?? 'Select course'
  const detail = verdictDetailQuery.data?.data
  const plagiarismStats = plagiarismStatsQuery.data?.data
  const evidenceChain = evidenceChainQuery.data?.data
  const queueCounts = {
    total: highRiskQuery.data?.data.length ?? 0,
    confirmed: (highRiskQuery.data?.data ?? []).filter((item) => item.status === 'confirmed_copy').length,
    reviewing: (highRiskQuery.data?.data ?? []).filter((item) => item.status === 'need_more_review').length,
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Review &amp; Verdict</h1>
          <p className="text-sm text-muted-foreground">Review flagged students, compare evidence, and send clear feedback.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className="border-0 bg-slate-100 text-slate-600 hover:bg-slate-100">{queueCounts.total} flagged cases</Badge>
          <Badge className="border-0 bg-rose-50 text-rose-600 hover:bg-rose-50">{queueCounts.confirmed} confirmed</Badge>
          <Badge className="border-0 bg-blue-50 text-blue-600 hover:bg-blue-50">{queueCounts.reviewing} under review</Badge>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-600">Course:</span>
          <div className="relative">
            <select
              className="h-11 min-w-[260px] appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15"
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value)
                setSelectedSubmissionId('')
                setOpenDetailDialog(false)
              }}
              disabled={coursesQuery.isLoading || !coursesQuery.data?.data.length}
            >
              {coursesQuery.data?.data.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
        {coursesQuery.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading courses...</p> : null}
        {coursesQuery.isError ? <p className="mt-3 text-sm text-destructive">{coursesQuery.error.message}</p> : null}
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Flagged Students</h2>
              <p className="mt-1 text-sm text-slate-500">Only the students returned by the API are shown here for {selectedCourseName}.</p>
            </div>

            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={queueSearch}
                onChange={(event) => setQueueSearch(event.target.value)}
                placeholder="Search student or assignment..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15"
              />
            </div>
          </div>

          <div className="space-y-3">
            {highRiskQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading high-risk submissions...</p> : null}
            {highRiskQuery.isError ? <p className="text-sm text-destructive">{highRiskQuery.error.message}</p> : null}
            {highRiskQuery.data?.data.length === 0 ? <p className="text-sm text-muted-foreground">No high-risk submissions found.</p> : null}
            {highRiskQuery.data?.data.length !== 0 && queueItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cases match the current search.</p>
            ) : null}

            {queueItems.map((item) => (
              <div
                key={item.submissionId}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-500" />
                      <p className="truncate text-lg font-semibold text-slate-900">{item.student}</p>
                    </div>
                    <p className="mt-2 truncate text-sm text-slate-500">{item.assignment}</p>
                    <p className="mt-1 truncate text-sm text-slate-400">{item.course}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Badge className="border-0 bg-rose-50 text-rose-600 hover:bg-rose-50">
                      {Math.round(item.highestSimilarity * 100)}%
                    </Badge>
                    <Badge className={queueStatusClass(item.status)}>{queueStatusLabel(item.status)}</Badge>
                  </div>
                </div>

                {item.reviewNote ? <p className="mt-4 line-clamp-2 text-sm text-slate-600">{item.reviewNote}</p> : null}

                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    onClick={() => onOpenDetail(item.submissionId, 'overview')}
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Overview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    onClick={() => onOpenDetail(item.submissionId, 'timeline')}
                  >
                    <History className="mr-1.5 h-3.5 w-3.5" />
                    Timeline
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 rounded-xl bg-slate-900 text-xs font-medium text-white hover:bg-slate-800"
                    onClick={() => onOpenDetail(item.submissionId, 'verdict')}
                  >
                    <Gavel className="mr-1.5 h-3.5 w-3.5" />
                    Verdict
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={openDetailDialog && Boolean(selectedSubmissionId)}
        onOpenChange={(open) => {
          setOpenDetailDialog(open)
          if (!open) {
            setSelectedSubmissionId('')
          }
        }}
      >
        {selectedSubmission ? (
          <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto rounded-3xl border-slate-200 p-0">
            <div className="border-b border-slate-200 px-8 py-7">
              <div className="flex flex-wrap items-start justify-between gap-4 pr-10">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{selectedSubmission.student}</h2>
                  <p className="mt-2 text-sm text-slate-500">{selectedSubmission.assignment}</p>
                  <p className="mt-1 text-sm text-slate-400">{selectedSubmission.course}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className="border-0 bg-rose-50 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50">
                    {Math.round(selectedSubmission.highestSimilarity * 100)}% similarity
                  </Badge>
                  <Badge className={`${queueStatusClass(selectedSubmission.status)} px-4 py-2 text-sm`}>
                    {queueStatusLabel(selectedSubmission.status)}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="bg-slate-50/50 px-8 py-3">
              <div className="flex gap-1 overflow-x-auto pb-1">
                <TabButton
                  active={activeTab === 'overview'}
                  onClick={() => setActiveTab('overview')}
                  icon={<LayoutDashboard className="h-4 w-4" />}
                  label="Evidence Overview"
                />
                <TabButton
                  active={activeTab === 'timeline'}
                  onClick={() => setActiveTab('timeline')}
                  icon={<History className="h-4 w-4" />}
                  label="Evidence Timeline"
                />
                <TabButton
                  active={activeTab === 'verdict'}
                  onClick={() => setActiveTab('verdict')}
                  icon={<Gavel className="h-4 w-4" />}
                  label="Final Verdict"
                />
              </div>
            </div>

            <div className="min-h-[500px] bg-white px-8 py-8">
              {activeTab === 'overview' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 duration-300">
                  <div className="grid gap-4 md:grid-cols-3">
                    <SummaryBlock
                      label="Highest Similarity"
                      value={plagiarismStats ? `${Math.round(plagiarismStats.highestSimilarity * 100)}%` : '...'}
                      tone="danger"
                    />
                    <SummaryBlock label="High-risk Matches" value={plagiarismStats ? String(plagiarismStats.highRiskCount) : '...'} />
                    <SummaryBlock label="Reviewer" value={detail?.reviewer ?? 'Pending'} />
                  </div>

                  <section className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">Key Evidence Findings</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Match results are highlighted below based on their risk level and similarity.
                      </p>
                    </div>

                    {verdictDetailQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading review summary...
                      </div>
                    ) : null}

                    {detail?.note ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                        <p className="text-sm font-semibold text-slate-900">Current Review Note</p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{detail.note}</p>
                      </div>
                    ) : null}

                    <div className="space-y-4">
                      {plagiarismStatsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading plagiarism stats...</p> : null}
                      {plagiarismStats?.matches.map((match, index) => {
                        const isOpen = expandedEvidenceId === match.plagiarismId
                        return (
                          <div
                            key={match.plagiarismId}
                            className={`rounded-2xl border transition-all ${match.highRisk ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'
                              }`}
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedEvidenceId(isOpen ? null : match.plagiarismId)}
                              className="flex w-full items-center justify-between gap-4 p-5 text-left"
                            >
                              <div className="flex items-center gap-4">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${match.highRisk ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                  <span className="text-sm font-bold">#{index + 1}</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-slate-900 truncate">Version Pair Comparison</p>
                                    {match.highRisk && <Badge className="border-0 bg-rose-500 text-white hover:bg-rose-500">Critical</Badge>}
                                  </div>
                                  <p className="mt-1 text-xs text-slate-400">ID: {match.submitVersionAId} vs {match.submitVersionBId}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <Badge className="border-0 bg-slate-100/80 text-slate-700 px-3 py-1 text-xs">{Math.round(match.similarity * 100)}% Similarity</Badge>
                                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                              </div>
                            </button>

                            {isOpen && (
                              <div className="border-t border-slate-100 p-5 space-y-4">
                                <EvidenceBlock commonLines={match.evidence.commonLines} commonTokens={match.evidence.commonTokens} />
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {!plagiarismStats?.matches.length && !plagiarismStatsQuery.isLoading ? (
                        <p className="text-sm text-slate-500 text-center py-8">No evidence matches available for this submission.</p>
                      ) : null}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Evidence Timeline</h3>
                    <p className="mt-1 text-sm text-slate-500">Explore the submission sequence and detailed side-by-side code blocks.</p>
                  </div>

                  {evidenceChainQuery.isLoading && <p className="text-sm text-muted-foreground">Loading evidence chain...</p>}

                  <div className="space-y-5">
                    {evidenceChain?.chain.map((item) => (
                      <EvidenceChainItem key={item.plagiarismId} item={item} />
                    ))}

                    {!evidenceChain?.chain.length && !evidenceChainQuery.isLoading ? (
                      <p className="text-sm text-slate-500 text-center py-8">No evidence chain available.</p>
                    ) : null}
                  </div>
                </div>
              )}

              {activeTab === 'verdict' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto max-w-2xl duration-300">
                  <Card className="rounded-3xl border-slate-200 shadow-lg">
                    <CardContent className="p-8">
                      <div className="mb-8 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-900">
                          <Gavel className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-slate-900">Final Decision</h3>
                          <p className="text-sm text-slate-500">Set the verdict and provide feedback for the student.</p>
                        </div>
                      </div>

                      <div className="space-y-6 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <SummaryBlock
                            label="Max Similarity"
                            value={plagiarismStats ? `${Math.round(plagiarismStats.highestSimilarity * 100)}%` : '...'}
                            tone="danger"
                          />
                          <SummaryBlock label="Current Verdict" value={detail?.verdict ?? 'Under Review'} />
                        </div>

                        <div className="space-y-3">
                          <label className="text-sm font-semibold text-slate-700">Set Verdict Status</label>
                          <select
                            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
                            value={verdict}
                            onChange={(event) => setVerdict(event.target.value as VerdictStatus)}
                          >
                            <option value="need_more_review">Need More Review</option>
                            <option value="confirmed_copy">Confirmed Copy</option>
                            <option value="clean">Clean / No Issue</option>
                          </select>
                        </div>

                        <div className="space-y-3">
                          <label className="text-sm font-semibold text-slate-700">Review Note & Detailed Feedback</label>
                          <textarea
                            className="min-h-56 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm leading-relaxed text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Explain the reason for this verdict. This feedback is critical for the student."
                          />
                        </div>

                        <Button
                          className="h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white transition-all hover:bg-slate-800 hover:shadow-lg active:scale-[0.98]"
                          disabled={!selectedSubmissionId || updateVerdictMutation.isPending}
                          onClick={() => updateVerdictMutation.mutate()}
                        >
                          {updateVerdictMutation.isPending ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Saving Decision...</span>
                            </div>
                          ) : (
                            'Submit Final Verdict'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-all ${active ? 'border-blue-600 bg-white text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
    >
      {icon}
      {label}
    </button>
  )
}

function SummaryBlock({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'danger'
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === 'danger' ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-slate-50/80'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone === 'danger' ? 'text-rose-500' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function queueStatusLabel(status: HighRiskSubmission['status']) {
  if (status === 'confirmed_copy') return 'Confirmed Copy'
  if (status === 'clean') return 'Clean'
  return 'Under Review'
}

function queueStatusClass(status: HighRiskSubmission['status']) {
  if (status === 'confirmed_copy') {
    return 'border-0 bg-rose-50 text-rose-600 hover:bg-rose-50'
  }
  if (status === 'clean') {
    return 'border-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-50'
  }
  return 'border-0 bg-blue-50 text-blue-600 hover:bg-blue-50'
}

function EvidenceChainItem({ item }: { item: EvidenceChain['chain'][0] }) {
  const [showCode, setShowCode] = useState(false)

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={
              item.highRisk
                ? 'border-0 bg-rose-50 text-rose-600 hover:bg-rose-50'
                : 'border-0 bg-amber-50 text-amber-600 hover:bg-amber-50'
            }
          >
            {item.highRisk ? 'High risk' : 'Review'}
          </Badge>
          <Badge className="border-0 bg-slate-100 text-slate-600 hover:bg-slate-100">
            {Math.round(item.similarity * 100)}% similarity
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowCode(!showCode)} className="text-primary hover:text-primary/80">
          {showCode ? 'Hide Comparison' : 'View Side-by-Side'}
        </Button>
      </div>

      <div className="grid gap-2 border-b border-dashed border-slate-100 pb-4 text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-900">{item.pair.studentA}</span> submitted at{' '}
          {new Date(item.pair.submittedAtA).toLocaleString()}
        </p>
        <p>
          <span className="font-medium text-slate-900">{item.pair.studentB}</span> submitted at{' '}
          {new Date(item.pair.submittedAtB).toLocaleString()}
        </p>
      </div>

      {showCode ? (
        <div className="mt-4 space-y-4">
          <CodePairComparison
            codeA={item.pair.codeA}
            codeB={item.pair.codeB}
            segments={item.evidence.segments}
            commonLines={item.evidence.commonLines}
            commonTokens={item.evidence.commonTokens}
            studentA={item.pair.studentA}
            studentB={item.pair.studentB}
          />
          <div className="rounded-xl bg-slate-50/50 p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Evidence Details</h4>
            <EvidenceBlock commonLines={item.evidence.commonLines} commonTokens={item.evidence.commonTokens} />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <EvidenceBlock commonLines={item.evidence.commonLines} commonTokens={item.evidence.commonTokens} />
        </div>
      )}
    </div>
  )
}

function CodePairComparison({
  codeA,
  codeB,
  segments,
  commonLines,
  commonTokens,
  studentA,
  studentB,
}: {
  codeA: string
  codeB: string
  segments: EvidenceChain['chain'][0]['evidence']['segments']
  commonLines: string[]
  commonTokens: string[]
  studentA: string
  studentB: string
}) {
  const [editorA, setEditorA] = useState<editor.IStandaloneCodeEditor | null>(null)
  const [editorB, setEditorB] = useState<editor.IStandaloneCodeEditor | null>(null)

  const applyDecorations = (editor: editor.IStandaloneCodeEditor, codeType: 'A' | 'B') => {
    const model = editor.getModel()
    if (!model) return

    const lineDecorations = segments.map((s) => ({
      range: {
        startLineNumber: codeType === 'A' ? s.linesA[0] : s.linesB[0],
        startColumn: 1,
        endLineNumber: codeType === 'A' ? s.linesA[1] : s.linesB[1],
        endColumn: 1000,
      },
      options: {
        isWholeLine: true,
        className: codeType === 'A' ? 'monaco-line-highlight-a' : 'monaco-line-highlight-b',
        glyphMarginClassName: codeType === 'A' ? 'monaco-line-highlight-a-glyph' : 'monaco-line-highlight-b-glyph',
        marginClassName: codeType === 'A' ? 'monaco-line-highlight-a-glyph' : 'monaco-line-highlight-b-glyph',
      },
    }))

    // Inline decorations for tokens
    const inlineDecorations: editor.IModelDeltaDecoration[] = []

    commonTokens.forEach((token) => {
      const matches = model.findMatches(token, false, false, true, null, true)
      matches.forEach((match) => {
        inlineDecorations.push({
          range: match.range,
          options: {
            inlineClassName: 'monaco-inline-highlight',
            hoverMessage: { value: `Common token: ${token}` },
          },
        })
      })
    })

    // Inline decorations for common lines (full matches)
    commonLines.forEach((lineText) => {
      if (!lineText.trim()) return
      const matches = model.findMatches(lineText, false, false, true, null, true)
      matches.forEach((match) => {
        inlineDecorations.push({
          range: match.range,
          options: {
            inlineClassName: 'monaco-inline-highlight',
            hoverMessage: { value: 'Common line match' },
          },
        })
      })
    })

    editor.deltaDecorations([], [...lineDecorations, ...inlineDecorations])
  }

  useEffect(() => {
    if (editorA) applyDecorations(editorA, 'A')
  }, [editorA, segments, commonLines, commonTokens])

  useEffect(() => {
    if (editorB) applyDecorations(editorB, 'B')
  }, [editorB, segments, commonLines, commonTokens])

  // Sync scroll
  useEffect(() => {
    if (!editorA || !editorB) return

    const disposableA = editorA.onDidScrollChange((e) => {
      if (e.scrollTopChanged) {
        editorB.setScrollTop(e.scrollTop)
      }
    })

    const disposableB = editorB.onDidScrollChange((e) => {
      if (e.scrollTopChanged) {
        editorA.setScrollTop(e.scrollTop)
      }
    })

    return () => {
      disposableA.dispose()
      disposableB.dispose()
    }
  }, [editorA, editorB])

  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    readOnly: true,
    minimap: { enabled: false },
    fontSize: 12,
    lineHeight: 20,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    glyphMargin: true,
    folding: true,
    lineNumbersMinChars: 3,
    theme: 'vs-dark',
    scrollbar: {
      vertical: 'hidden',
      horizontal: 'auto',
    },
  }

  return (
    <div className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-800 bg-[#1e1e1e]">
      <div className="grid h-[500px] overflow-hidden lg:grid-cols-2">
        {/* Version A */}
        <div className="flex flex-col border-slate-800 lg:border-r">
          <div className="border-b border-slate-800 bg-[#252526] px-4 py-2">
            <p className="text-xs font-semibold text-slate-400">Version A: {studentA}</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language="javascript"
              value={codeA}
              theme="vs-dark"
              options={editorOptions}
              onMount={(editor) => setEditorA(editor)}
            />
          </div>
        </div>

        {/* Version B */}
        <div className="flex flex-col">
          <div className="border-b border-slate-800 bg-[#252526] px-4 py-2">
            <p className="text-xs font-semibold text-slate-400">Version B: {studentB}</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language="javascript"
              value={codeB}
              theme="vs-dark"
              options={editorOptions}
              onMount={(editor) => setEditorB(editor)}
            />
          </div>
        </div>
      </div>

      {segments.length > 0 && (
        <div className="border-t border-slate-800 bg-[#252526] px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Matching Segments</p>
          <div className="mt-2 space-y-2">
            {segments.map((seg, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    editorA?.revealLineInCenter(seg.linesA[0])
                    editorB?.revealLineInCenter(seg.linesB[0])
                  }}
                  className="rounded bg-rose-900/40 px-1.5 py-0.5 font-medium text-rose-300 transition hover:bg-rose-900/60"
                >
                  Similarity: {Math.round(seg.similarity * 100)}%
                </button>
                <span className="text-slate-400 italic">
                  "{seg.title}" ({seg.description})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EvidenceBlock({ commonLines, commonTokens }: { commonLines: string[]; commonTokens: string[] }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Common Lines</p>
        {commonLines.length === 0 ? (
          <p className="text-xs text-slate-400">No direct common lines.</p>
        ) : (
          <div className="space-y-2">
            {commonLines.slice(0, 4).map((line, index) => (
              <pre key={`${line}-${index}`} className="overflow-x-auto rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-xs text-slate-700">
                <code>{line}</code>
              </pre>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Common Tokens</p>
        {commonTokens.length === 0 ? (
          <p className="text-xs text-slate-400">No common tokens.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {commonTokens.slice(0, 12).map((token, index) => (
              <Badge key={`${token}-${index}`} className="border-0 bg-amber-50 text-amber-700 hover:bg-amber-50">
                {token}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
