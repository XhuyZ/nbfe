import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import Editor from '@monaco-editor/react'
import { useEffect } from 'react'
import { CalendarClock, Clock3, Gauge, ShieldAlert, Trophy } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getStudentSubmissions, type SubmissionItem } from '@/lib/submissions-api'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/submissions')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'student') {
      throw redirect({ to: `/${role}` as '/teacher' | '/admin' })
    }
  },
  component: SubmissionsPage,
})

function SubmissionsPage() {
  const { accessToken } = useAuth()

  const submissionsQuery = useQuery<{ message: string; data: SubmissionItem[] }, Error>({
    queryKey: ['submissions', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getStudentSubmissions(accessToken!),
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

  if (submissionsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading submissions...</p>
  }

  if (submissionsQuery.isError) {
    return <p className="text-sm text-destructive">{submissionsQuery.error.message}</p>
  }

  const submissions = submissionsQuery.data?.data ?? []

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">My Submissions</h1>
        <p className="text-sm text-muted-foreground">Assignments you have submitted.</p>
      </div>

      {submissions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">No submissions found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">{item.assignment.title}</CardTitle>
                  <Badge variant="outline">{item.status}</Badge>
                  <Badge variant="secondary">{item.language}</Badge>
                  <Badge variant={item.judgeStatus === 'completed' ? 'default' : 'outline'}>
                    judge: {item.judgeStatus ?? 'pending'}
                  </Badge>
                  <Badge variant={item.plagiarismStatus === 'completed' ? 'default' : 'outline'}>
                    plagiarism: {item.plagiarismStatus ?? 'pending'}
                  </Badge>
                </div>
                <CardDescription>{item.assignment.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Deadline:</span>
                    <span className="font-medium">{new Date(item.assignment.deadline).toLocaleString()}</span>
                  </div>

                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Submitted:</span>
                    <span className="font-medium">{new Date(item.lastSubmittedAt ?? item.created_at).toLocaleString()}</span>
                  </div>

                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Score:</span>
                    <span className="font-medium">{item.score ?? 'Not graded'}</span>
                  </div>

                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Plagiarism:</span>
                    <span className="font-medium">{item.plagiarismFlag ? 'Detected' : 'Clear'}</span>
                  </div>

                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Pass rate:</span>
                    <span className="font-medium">{item.passRate ?? 0}%</span>
                  </div>

                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Similarity:</span>
                    <span className="font-medium">
                      {item.highestSimilarity !== null && item.highestSimilarity !== undefined
                        ? `${Math.round(item.highestSimilarity * 100)}%`
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">Submission version: {item.versionCount ?? 1}</p>

                {item.code ? (
                  <div className="overflow-hidden rounded-md border">
                    <Editor
                      height="220px"
                      language={item.language === 'cpp' ? 'cpp' : item.language}
                      theme="vs-dark"
                      value={item.code}
                      options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No inline code submitted.</p>
                )}

                {item.file ? (
                  <a href={item.file} target="_blank" rel="noreferrer" className="inline-flex text-xs text-primary underline">
                    View submitted file
                  </a>
                ) : null}

                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Latest test results</p>
                  {!item.latestTestResults || item.latestTestResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No test results available yet.</p>
                  ) : (
                    item.latestTestResults.map((result) => (
                      <div key={result.id} className="rounded-md border p-2 text-xs">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge variant={result.passed ? 'default' : 'outline'}>
                            {result.passed ? 'passed' : 'failed'}
                          </Badge>
                          <span>case #{result.testCase.orderIndex}</span>
                          <span>weight: {result.testCase.weight}</span>
                        </div>
                        <p>
                          <span className="font-medium">Input:</span> {result.testCase.input}
                        </p>
                        <p>
                          <span className="font-medium">Expected:</span> {result.testCase.expectedOutput ?? '(hidden)'}
                        </p>
                        <p>
                          <span className="font-medium">Actual:</span> {result.actualOutput ?? '(none)'}
                        </p>
                        <p>
                          <span className="font-medium">Runtime:</span> {result.executionTimeMs ?? 0} ms
                        </p>
                        {result.errorMessage ? (
                          <p className="text-destructive">
                            <span className="font-medium">Error:</span> {result.errorMessage}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
