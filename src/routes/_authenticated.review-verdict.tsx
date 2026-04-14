import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AlertTriangle, Loader2, Scale, ShieldAlert } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { getAllCourses, getTeachingCourses, type CourseItem } from '@/lib/courses-api'
import {
  getEvidenceChain,
  getHighRiskSubmissions,
  getReviewVerdictDetail,
  getSubmissionPlagiarismStats,
  updateReviewVerdict,
  type VerdictStatus,
} from '@/lib/review-verdict-api'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/review-verdict')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'teacher' && role !== 'admin') {
      throw redirect({ to: `/${role}` as '/student' })
    }
  },
  component: ReviewVerdictPage,
})

function ReviewVerdictPage() {
  const queryClient = useQueryClient()
  const { accessToken, user } = useAuth()
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('')
  const [verdict, setVerdict] = useState<VerdictStatus>('need_more_review')
  const [note, setNote] = useState('')

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

  useEffect(() => {
    const firstSubmissionId = highRiskQuery.data?.data[0]?.submissionId ?? ''
    if (!selectedSubmissionId && firstSubmissionId) {
      setSelectedSubmissionId(firstSubmissionId)
    }
  }, [highRiskQuery.data?.data, selectedSubmissionId])

  useEffect(() => {
    const hasSelected = highRiskQuery.data?.data.some((item) => item.submissionId === selectedSubmissionId) ?? false
    if (selectedSubmissionId && !hasSelected) {
      setSelectedSubmissionId(highRiskQuery.data?.data[0]?.submissionId ?? '')
    }
  }, [highRiskQuery.data?.data, selectedSubmissionId])

  const selectedSubmission = highRiskQuery.data?.data.find((item) => item.submissionId === selectedSubmissionId) ?? null

  const verdictDetailQuery = useQuery({
    queryKey: ['review-verdict-detail', accessToken, selectedSubmissionId],
    enabled: Boolean(accessToken && selectedSubmissionId),
    queryFn: async () => getReviewVerdictDetail(accessToken!, selectedSubmissionId),
  })

  const plagiarismStatsQuery = useQuery({
    queryKey: ['review-plagiarism-stats', accessToken, selectedSubmissionId],
    enabled: Boolean(accessToken && selectedSubmissionId),
    queryFn: async () => getSubmissionPlagiarismStats(accessToken!, selectedSubmissionId),
  })

  const evidenceChainQuery = useQuery({
    queryKey: ['review-evidence-chain', accessToken, selectedSubmissionId],
    enabled: Boolean(accessToken && selectedSubmissionId),
    queryFn: async () => getEvidenceChain(accessToken!, selectedSubmissionId),
  })

  useEffect(() => {
    const detail = verdictDetailQuery.data?.data
    if (detail) {
      setVerdict(detail.verdict)
      setNote(detail.note ?? '')
    }
  }, [verdictDetailQuery.data?.data])

  const updateVerdictMutation = useMutation({
    mutationFn: async () => updateReviewVerdict(accessToken!, selectedSubmissionId, { verdict, note }),
    onSuccess: async (result) => {
      toast.success(result.message)
      await queryClient.invalidateQueries({ queryKey: ['review-high-risk', accessToken, selectedCourseId] })
      await queryClient.invalidateQueries({ queryKey: ['review-verdict-detail', accessToken, selectedSubmissionId] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update verdict'),
  })

  const statsSummary = useMemo(() => {
    const stats = plagiarismStatsQuery.data?.data
    if (!stats) return null

    return [
      { label: 'Highest Similarity', value: `${Math.round(stats.highestSimilarity * 100)}%` },
      { label: 'High-risk Matches', value: stats.highRiskCount },
      { label: 'Total Matches', value: stats.matches.length },
      { label: 'Student', value: stats.student.username },
    ]
  }, [plagiarismStatsQuery.data?.data])

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Review & Verdict</h1>
        <p className="text-sm text-muted-foreground">Inspect high-risk submissions, analyze evidence, and record the final verdict.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course Scope</CardTitle>
          <CardDescription>Select a course to load high-risk submissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="review-course">Course</Label>
          <select
            id="review-course"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm md:max-w-xl"
            value={selectedCourseId}
            onChange={(event) => {
              setSelectedCourseId(event.target.value)
              setSelectedSubmissionId('')
            }}
            disabled={coursesQuery.isLoading || !coursesQuery.data?.data.length}
          >
            {coursesQuery.data?.data.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
          {coursesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading courses...</p> : null}
          {coursesQuery.isError ? <p className="text-sm text-destructive">{coursesQuery.error.message}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>High-risk Queue</CardTitle>
            <CardDescription>Submissions that require manual review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {highRiskQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading high-risk submissions...</p> : null}
            {highRiskQuery.isError ? <p className="text-sm text-destructive">{highRiskQuery.error.message}</p> : null}
            {highRiskQuery.data?.data.length === 0 ? <p className="text-sm text-muted-foreground">No high-risk submissions found.</p> : null}

            {highRiskQuery.data?.data.map((item) => (
              <button
                key={item.submissionId}
                type="button"
                onClick={() => setSelectedSubmissionId(item.submissionId)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  selectedSubmissionId === item.submissionId ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{item.student}</p>
                    <p className="text-xs text-muted-foreground">{item.assignment}</p>
                  </div>
                  <Badge variant={item.status === 'confirmed_copy' ? 'default' : item.status === 'clean' ? 'secondary' : 'outline'}>
                    {item.status}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.course}</span>
                  <span>{Math.round(item.highestSimilarity * 100)}%</span>
                </div>
                {item.reviewNote ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.reviewNote}</p> : null}
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!selectedSubmissionId ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">Select a submission from the high-risk queue to review details.</CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {statsSummary?.map((item) => (
                  <Card key={item.label}>
                    <CardHeader className="pb-2">
                      <CardDescription>{item.label}</CardDescription>
                      <CardTitle className="text-2xl">{item.value}</CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>Review Summary</CardTitle>
                    {selectedSubmission ? (
                      <Badge variant={selectedSubmission.status === 'confirmed_copy' ? 'default' : selectedSubmission.status === 'clean' ? 'secondary' : 'outline'}>
                        {selectedSubmission.status}
                      </Badge>
                    ) : null}
                  </div>
                  <CardDescription>Overall manual review status and direct matches.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {verdictDetailQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading review summary...
                    </div>
                  ) : null}
                  {verdictDetailQuery.isError ? <p className="text-sm text-destructive">{verdictDetailQuery.error.message}</p> : null}

                  {verdictDetailQuery.data ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <InfoBlock label="Reviewer" value={verdictDetailQuery.data.data.reviewer ?? 'Pending'} />
                        <InfoBlock label="Reviewed At" value={verdictDetailQuery.data.data.reviewedAt ? new Date(verdictDetailQuery.data.data.reviewedAt).toLocaleString() : 'Not reviewed'} />
                        <InfoBlock label="Current Verdict" value={verdictDetailQuery.data.data.verdict} />
                      </div>
                      <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium">Review Note</p>
                        <p className="mt-1 text-muted-foreground">{verdictDetailQuery.data.data.note ?? 'No review note yet.'}</p>
                      </div>
                      <div className="space-y-3">
                        {verdictDetailQuery.data.data.matches.map((match) => (
                          <div key={match.plagiarismId} className="rounded-md border p-3 text-sm">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge variant={match.highRisk ? 'default' : 'outline'}>
                                {match.highRisk ? 'high risk' : 'medium risk'}
                              </Badge>
                              <Badge variant="secondary">{Math.round(match.similarity * 100)}% similarity</Badge>
                            </div>
                            <EvidenceBlock
                              commonLines={match.evidence.commonLines}
                              commonTokens={match.evidence.commonTokens}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                      <CardTitle>Plagiarism Stats</CardTitle>
                    </div>
                    <CardDescription>Similarity statistics and evidence by matched versions.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {plagiarismStatsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading plagiarism stats...</p> : null}
                    {plagiarismStatsQuery.isError ? <p className="text-sm text-destructive">{plagiarismStatsQuery.error.message}</p> : null}
                    {plagiarismStatsQuery.data?.data.matches.map((match) => (
                      <div key={match.plagiarismId} className="rounded-md border p-3 text-sm">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant={match.highRisk ? 'default' : 'outline'}>
                            {match.highRisk ? 'high risk' : 'review'}
                          </Badge>
                          <Badge variant="secondary">{Math.round(match.similarity * 100)}% similarity</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Version pair: `{match.submitVersionAId}` vs `{match.submitVersionBId}`
                        </p>
                        <div className="mt-3">
                          <EvidenceBlock
                            commonLines={match.evidence.commonLines}
                            commonTokens={match.evidence.commonTokens}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                      <CardTitle>Evidence Chain</CardTitle>
                    </div>
                    <CardDescription>Timeline and pairing evidence between submissions.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {evidenceChainQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading evidence chain...</p> : null}
                    {evidenceChainQuery.isError ? <p className="text-sm text-destructive">{evidenceChainQuery.error.message}</p> : null}
                    {evidenceChainQuery.data?.data.chain.map((item) => (
                      <div key={item.plagiarismId} className="rounded-md border p-3 text-sm">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant={item.highRisk ? 'default' : 'outline'}>
                            {item.highRisk ? 'high risk' : 'review'}
                          </Badge>
                          <Badge variant="secondary">{Math.round(item.similarity * 100)}% similarity</Badge>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>{item.pair.studentA} submitted at {new Date(item.pair.submittedAtA).toLocaleString()}</p>
                          <p>{item.pair.studentB} submitted at {new Date(item.pair.submittedAtB).toLocaleString()}</p>
                        </div>
                        <div className="mt-3">
                          <EvidenceBlock
                            commonLines={item.evidence.commonLines}
                            commonTokens={item.evidence.commonTokens}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>Final Verdict</CardTitle>
                  </div>
                  <CardDescription>Record the final decision for this submission.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="verdict">Verdict</Label>
                      <select
                        id="verdict"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={verdict}
                        onChange={(event) => setVerdict(event.target.value as VerdictStatus)}
                      >
                        <option value="need_more_review">need_more_review</option>
                        <option value="confirmed_copy">confirmed_copy</option>
                        <option value="clean">clean</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="submission-id">Submission ID</Label>
                      <input
                        id="submission-id"
                        value={selectedSubmissionId}
                        readOnly
                        className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="review-note">Review Note</Label>
                    <textarea
                      id="review-note"
                      className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Summarize the evidence and final decision..."
                    />
                  </div>
                  <Button disabled={!selectedSubmissionId || updateVerdictMutation.isPending} onClick={() => updateVerdictMutation.mutate()}>
                    {updateVerdictMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving verdict...
                      </>
                    ) : (
                      'Save verdict'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  )
}

function EvidenceBlock({ commonLines, commonTokens }: { commonLines: string[]; commonTokens: string[] }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Common Lines</p>
        {commonLines.length === 0 ? (
          <p className="text-xs text-muted-foreground">No direct common lines.</p>
        ) : (
          <div className="space-y-1">
            {commonLines.map((line, index) => (
              <pre key={`${line}-${index}`} className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
                <code>{line}</code>
              </pre>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Common Tokens</p>
        {commonTokens.length === 0 ? (
          <p className="text-xs text-muted-foreground">No common tokens.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {commonTokens.map((token, index) => (
              <Badge key={`${token}-${index}`} variant="outline">
                {token}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
