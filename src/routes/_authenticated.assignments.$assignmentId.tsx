import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import Editor from '@monaco-editor/react'
import { ArrowLeft, FileUp, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DocumentPreviewDialog } from '@/components/document-preview-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAssignmentById } from '@/lib/assignments-api'
import { submitAssignmentWithCode, submitAssignmentWithFile } from '@/lib/student-submit-api'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/assignments/$assignmentId')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'student') {
      throw redirect({ to: `/${role}` as '/teacher' | '/admin' })
    }
  },
  component: AssignmentDetailPage,
})

function AssignmentDetailPage() {
  const { assignmentId } = Route.useParams()
  const { accessToken } = useAuth()
  const navigate = useNavigate()

  const [language, setLanguage] = useState('javascript')
  const [code, setCode] = useState('// Write your solution here')
  const [file, setFile] = useState<File | null>(null)

  const assignmentQuery = useQuery({
    queryKey: ['assignment-detail', assignmentId, accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getAssignmentById(accessToken!, assignmentId),
  })

  useEffect(() => {
    if (assignmentQuery.isSuccess) {
      toast.success(assignmentQuery.data.message)
    }
  }, [assignmentQuery.isSuccess, assignmentQuery.data?.message])

  useEffect(() => {
    if (assignmentQuery.isError) {
      toast.error(assignmentQuery.error.message)
    }
  }, [assignmentQuery.isError, assignmentQuery.error?.message])

  const submitCodeMutation = useMutation({
    mutationFn: async () => submitAssignmentWithCode(accessToken!, { assignmentId, code, language }),
    onSuccess: (result) => {
      toast.success(result.message)
      navigate({ to: '/submissions' })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Submit code failed'),
  })

  const submitFileMutation = useMutation({
    mutationFn: async () => submitAssignmentWithFile(accessToken!, { assignmentId, file: file!, language }),
    onSuccess: (result) => {
      toast.success(result.message)
      navigate({ to: '/submissions' })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Submit file failed'),
  })

  if (assignmentQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading assignment details...</p>
  }

  if (assignmentQuery.isError) {
    return <p className="text-sm text-destructive">{assignmentQuery.error.message}</p>
  }

  if (!assignmentQuery.data) {
    return <p className="text-sm text-muted-foreground">No assignment data.</p>
  }

  const assignment = assignmentQuery.data.data

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link to="/assignments">
            <ArrowLeft className="h-4 w-4" />
            Back to assignments
          </Link>
        </Button>
        <Badge variant={assignment.status === 'open' ? 'default' : 'outline'}>{assignment.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{assignment.title}</CardTitle>
          <CardDescription>{assignment.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <p>
            <span className="font-medium">Teacher:</span> {assignment.teacher.username}
          </p>
          <p>
            <span className="font-medium">Deadline:</span> {new Date(assignment.deadline).toLocaleString()}
          </p>
          <p>
            <span className="font-medium">Max score:</span> {assignment.maxScore ?? 100}
          </p>
          <p>
            <span className="font-medium">Late submission:</span> {assignment.allowLateSubmission ? 'Allowed' : 'Not allowed'}
          </p>
          <p className="md:col-span-2">
            <span className="font-medium">Evaluation criteria:</span> {assignment.evaluationCriteria ?? 'N/A'}
          </p>
          {assignment.document ? (
            <div className="md:col-span-2">
              <DocumentPreviewDialog fileUrl={assignment.document} fileName={`${assignment.title} document`} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submit Your Solution</CardTitle>
          <CardDescription>Use Monaco editor for code submission or upload a source file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="javascript">javascript</option>
                <option value="typescript">typescript</option>
                <option value="python">python</option>
                <option value="java">java</option>
                <option value="cpp">cpp</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border">
            <Editor
              height="360px"
              language={language === 'cpp' ? 'cpp' : language}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value ?? '')}
              options={{ minimap: { enabled: false }, fontSize: 14 }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={submitCodeMutation.isPending || !code.trim()} onClick={() => submitCodeMutation.mutate()}>
              {submitCodeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting code...
                </>
              ) : (
                'Submit code'
              )}
            </Button>
          </div>

          <div className="rounded-md border p-4">
            <div className="space-y-3">
              <Label htmlFor="submit-file">Or submit file</Label>
              <Input id="submit-file" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              <Button
                variant="outline"
                disabled={!file || submitFileMutation.isPending}
                onClick={() => submitFileMutation.mutate()}
              >
                {submitFileMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    Submit file
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
