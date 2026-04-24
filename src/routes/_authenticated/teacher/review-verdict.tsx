import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AlertTriangle, ChevronDown, Loader2, Scale, Search } from 'lucide-react'
import { toast } from 'react-toastify'

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

function ReviewVerdictPage() {
  const queryClient = useQueryClient()
  const { accessToken, user } = useAuth()
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('')
  const [openDetailDialog, setOpenDetailDialog] = useState(false)
  const [verdict, setVerdict] = useState<VerdictStatus>('need_more_review')
  const [note, setNote] = useState('')
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
              <button
                key={item.submissionId}
                type="button"
                onClick={() => {
                  setSelectedSubmissionId(item.submissionId)
                  setOpenDetailDialog(true)
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:bg-slate-50/80"
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
              </button>
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

            <div className="grid gap-6 px-8 py-7 lg:grid-cols-[minmax(0,1.35fr)_360px]">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <SummaryBlock
                    label="Highest Similarity"
                    value={plagiarismStats ? `${Math.round(plagiarismStats.highestSimilarity * 100)}%` : '...'}
                    tone="danger"
                  />
                  <SummaryBlock label="High-risk Matches" value={plagiarismStats ? String(plagiarismStats.highRiskCount) : '...'} />
                  <SummaryBlock label="Reviewer" value={detail?.reviewer ?? 'Pending'} />
                </div>

                <section className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Evidence Overview</h3>
                    <p className="mt-1 text-sm text-slate-500">Key match results are highlighted below so reviewers can focus on the strongest signals first.</p>
                  </div>

                  {verdictDetailQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading review summary...
                    </div>
                  ) : null}
                  {verdictDetailQuery.isError ? <p className="text-sm text-destructive">{verdictDetailQuery.error.message}</p> : null}

                  {detail?.note ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-sm font-medium text-slate-900">Existing Review Note</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{detail.note}</p>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {plagiarismStatsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading plagiarism stats...</p> : null}
                    {plagiarismStatsQuery.isError ? <p className="text-sm text-destructive">{plagiarismStatsQuery.error.message}</p> : null}

                    {plagiarismStats?.matches.map((match, index) => {
                      const isOpen = expandedEvidenceId === match.plagiarismId

                      return (
                        <div
                          key={match.plagiarismId}
                          className={`rounded-2xl border ${
                            match.highRisk ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedEvidenceId(isOpen ? null : match.plagiarismId)}
                            className="flex w-full items-center justify-between gap-3 p-4 text-left"
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-slate-900">Version Match #{index + 1}</p>
                                {match.highRisk ? (
                                  <Badge className="border-0 bg-rose-100 text-rose-600 hover:bg-rose-100">Primary Flag</Badge>
                                ) : (
                                  <Badge className="border-0 bg-amber-100 text-amber-600 hover:bg-amber-100">Secondary Flag</Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-slate-400">
                                Version pair: `{match.submitVersionAId}` vs `{match.submitVersionBId}`
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={match.highRisk ? 'border-0 bg-rose-50 text-rose-600 hover:bg-rose-50' : 'border-0 bg-amber-50 text-amber-600 hover:bg-amber-50'}>
                                {match.highRisk ? 'High risk' : 'Review'}
                              </Badge>
                              <Badge className="border-0 bg-slate-100 text-slate-600 hover:bg-slate-100">
                                {Math.round(match.similarity * 100)}%
                              </Badge>
                            </div>
                          </button>

                          {isOpen ? (
                            <div className="border-t border-slate-200 px-4 py-4">
                              <EvidenceBlock commonLines={match.evidence.commonLines} commonTokens={match.evidence.commonTokens} />
                            </div>
                          ) : null}
                        </div>
                      )
                    })}

                    {!plagiarismStats?.matches.length ? <p className="text-sm text-slate-500">No evidence matches available.</p> : null}
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Evidence Timeline</h3>
                    <p className="mt-1 text-sm text-slate-500">Submission order and paired evidence are shown in a simpler timeline style.</p>
                  </div>

                  {evidenceChainQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading evidence chain...</p> : null}
                  {evidenceChainQuery.isError ? <p className="text-sm text-destructive">{evidenceChainQuery.error.message}</p> : null}

                  <div className="space-y-3">
                    {evidenceChain?.chain.map((item) => (
                      <div key={item.plagiarismId} className="rounded-2xl border border-slate-200 p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge className={item.highRisk ? 'border-0 bg-rose-50 text-rose-600 hover:bg-rose-50' : 'border-0 bg-amber-50 text-amber-600 hover:bg-amber-50'}>
                            {item.highRisk ? 'High risk' : 'Review'}
                          </Badge>
                          <Badge className="border-0 bg-slate-100 text-slate-600 hover:bg-slate-100">
                            {Math.round(item.similarity * 100)}% similarity
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-slate-600">
                          <p>{item.pair.studentA} submitted at {new Date(item.pair.submittedAtA).toLocaleString()}</p>
                          <p>{item.pair.studentB} submitted at {new Date(item.pair.submittedAtB).toLocaleString()}</p>
                        </div>
                        <div className="mt-4">
                          <EvidenceBlock commonLines={item.evidence.commonLines} commonTokens={item.evidence.commonTokens} />
                        </div>
                      </div>
                    ))}

                    {!evidenceChain?.chain.length ? <p className="text-sm text-slate-500">No evidence chain available.</p> : null}
                  </div>
                </section>
              </div>

              <div className="space-y-4 lg:sticky lg:top-0">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Scale className="h-5 w-5 text-slate-500" />
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">Verdict Panel</h3>
                      <p className="text-sm text-slate-500">Use the highlighted flags and evidence to make a final decision.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <SummaryBlock
                      label="Similarity"
                      value={plagiarismStats ? `${Math.round(plagiarismStats.highestSimilarity * 100)}%` : '...'}
                      tone="danger"
                    />
                    <SummaryBlock label="Current Verdict" value={detail?.verdict ?? 'need_more_review'} />
                    <SummaryBlock
                      label="Reviewed At"
                      value={detail?.reviewedAt ? new Date(detail.reviewedAt).toLocaleString() : 'Not reviewed'}
                    />

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Visual Flags</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className="border-0 bg-rose-50 text-rose-600 hover:bg-rose-50">High similarity</Badge>
                        {(plagiarismStats?.highRiskCount ?? 0) > 0 ? (
                          <Badge className="border-0 bg-amber-50 text-amber-600 hover:bg-amber-50">
                            {plagiarismStats?.highRiskCount} high-risk matches
                          </Badge>
                        ) : null}
                        <Badge className={queueStatusClass(selectedSubmission.status)}>{queueStatusLabel(selectedSubmission.status)}</Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Verdict</label>
                      <select
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15"
                        value={verdict}
                        onChange={(event) => setVerdict(event.target.value as VerdictStatus)}
                      >
                        <option value="need_more_review">need_more_review</option>
                        <option value="confirmed_copy">confirmed_copy</option>
                        <option value="clean">clean</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Review Note</label>
                      <textarea
                        className="min-h-48 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Summarize the evidence and final decision..."
                      />
                    </div>

                    <Button className="h-11 w-full rounded-xl" disabled={!selectedSubmissionId || updateVerdictMutation.isPending} onClick={() => updateVerdictMutation.mutate()}>
                      {updateVerdictMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving verdict...
                        </>
                      ) : (
                        'Save verdict'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
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
