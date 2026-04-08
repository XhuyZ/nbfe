import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Loader2, Plus, Upload } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DocumentPreviewDialog } from '@/components/document-preview-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type AssignmentDocument,
  type AssignmentTestCase,
  addAssignmentDocument,
  createAssignment,
  getAllAssignmentDocuments,
  getAssignmentDetails,
  getAssignmentDocuments,
  getAssignmentTestCases,
  getTeacherAssignments,
  updateAssignment,
  type TeacherAssignment,
  type UpdateAssignmentPayload,
} from '@/lib/teacher-assignments-api'
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
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [openAssignmentDialog, setOpenAssignmentDialog] = useState(false)
  const [openDocumentsDialog, setOpenDocumentsDialog] = useState(false)
  const [openTestCasesDialog, setOpenTestCasesDialog] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  const [selectedAssignmentTitle, setSelectedAssignmentTitle] = useState<string>('')
  const [selectedDocuments, setSelectedDocuments] = useState<AssignmentDocument[]>([])
  const [selectedTestCases, setSelectedTestCases] = useState<AssignmentTestCase[]>([])
  const [manageDocumentFile, setManageDocumentFile] = useState<File | null>(null)

  const [createTitle, setCreateTitle] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createDeadline, setCreateDeadline] = useState('')
  const [createStatus, setCreateStatus] = useState<'open' | 'closed'>('open')
  const [createMaxScore, setCreateMaxScore] = useState(100)
  const [createCriteria, setCreateCriteria] = useState('')
  const [createAllowLate, setCreateAllowLate] = useState(false)
  const [createFile, setCreateFile] = useState<File | null>(null)
  const [createTestCases, setCreateTestCases] = useState<
    Array<{ input: string; expectedOutput: string; isSample: boolean; weight: number }>
  >([{ input: '', expectedOutput: '', isSample: true, weight: 1 }])
  const [manageForm, setManageForm] = useState<UpdateAssignmentPayload>({
    title: '',
    description: '',
    deadline: '',
    status: 'open',
    maxScore: 100,
    evaluationCriteria: '',
    allowLateSubmission: false,
  })

  const assignmentsQuery = useQuery<{ message: string; data: TeacherAssignment[] }, Error>({
    queryKey: ['teacher-assignments', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getTeacherAssignments(accessToken!),
  })

  const allDocsQuery = useQuery<{ message: string; data: Array<{ assignmentId?: string; assignmentTitle?: string; fileUrl: string; fileName: string }> }, Error>({
    queryKey: ['teacher-assignment-documents', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getAllAssignmentDocuments(accessToken!),
  })

  useEffect(() => {
    if (assignmentsQuery.isSuccess) toast.success(assignmentsQuery.data.message)
  }, [assignmentsQuery.isSuccess, assignmentsQuery.data?.message])

  useEffect(() => {
    if (assignmentsQuery.isError) toast.error(assignmentsQuery.error.message)
  }, [assignmentsQuery.isError, assignmentsQuery.error?.message])

  useEffect(() => {
    if (allDocsQuery.isSuccess) toast.success(allDocsQuery.data.message)
  }, [allDocsQuery.isSuccess, allDocsQuery.data?.message])

  useEffect(() => {
    if (allDocsQuery.isError) toast.error(allDocsQuery.error.message)
  }, [allDocsQuery.isError, allDocsQuery.error?.message])

  const createMutation = useMutation({
    mutationFn: async () =>
      createAssignment(accessToken!, {
        title: createTitle,
        description: createDescription,
        deadline: new Date(createDeadline).toISOString(),
        status: createStatus,
        maxScore: createMaxScore,
        testCases: createTestCases.map((testCase, index) => ({
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          isSample: testCase.isSample,
          weight: testCase.weight,
          orderIndex: index + 1,
        })),
        evaluationCriteria: createCriteria,
        allowLateSubmission: createAllowLate,
        document: createFile,
      }),
    onSuccess: async (result) => {
      toast.success(result.message)
      setOpenCreateDialog(false)
      setCreateTitle('')
      setCreateDescription('')
      setCreateDeadline('')
      setCreateStatus('open')
      setCreateMaxScore(100)
      setCreateCriteria('')
      setCreateAllowLate(false)
      setCreateFile(null)
      setCreateTestCases([{ input: '', expectedOutput: '', isSample: true, weight: 1 }])
      await queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] })
      await queryClient.invalidateQueries({ queryKey: ['teacher-assignment-documents'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Create assignment failed'),
  })

  const detailsMutation = useMutation({
    mutationFn: async (assignmentId: string) => getAssignmentDetails(accessToken!, assignmentId),
    onSuccess: (result) => {
      toast.success(result.message)
      setManageForm({
        title: result.data.title,
        description: result.data.description,
        deadline: new Date(result.data.deadline).toISOString().slice(0, 16),
        status: result.data.status,
        maxScore: result.data.maxScore,
        evaluationCriteria: result.data.evaluationCriteria,
        allowLateSubmission: result.data.allowLateSubmission,
      })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Load details failed'),
  })

  const docsByAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => getAssignmentDocuments(accessToken!, assignmentId),
    onSuccess: (result) => {
      toast.success(result.message)
      setSelectedDocuments(result.data)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Load documents failed'),
  })

  const testCasesByAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => getAssignmentTestCases(accessToken!, assignmentId),
    onSuccess: (result) => {
      toast.success(result.message)
      setSelectedTestCases(result.data)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Load test cases failed'),
  })

  const uploadDocMutation = useMutation({
    mutationFn: async (params: { assignmentId: string; file: File }) =>
      addAssignmentDocument(accessToken!, params.assignmentId, params.file),
    onSuccess: async (result) => {
      toast.success(result.message)
      if (selectedAssignmentId) {
        docsByAssignmentMutation.mutate(selectedAssignmentId)
      }
      await queryClient.invalidateQueries({ queryKey: ['teacher-assignment-documents'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Upload document failed'),
  })

  const updateMutation = useMutation({
    mutationFn: async (params: { assignmentId: string; payload: UpdateAssignmentPayload }) =>
      updateAssignment(accessToken!, params.assignmentId, params.payload),
    onSuccess: async (result) => {
      toast.success(result.message)
      if (selectedAssignmentId) {
        detailsMutation.mutate(selectedAssignmentId)
      }
      await queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Update assignment failed'),
  })

  const onCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createMutation.mutate()
  }

  const onOpenManageAssignment = (assignment: TeacherAssignment) => {
    setSelectedAssignmentId(assignment.id)
    setSelectedAssignmentTitle(assignment.title)
    setOpenAssignmentDialog(true)
    detailsMutation.mutate(assignment.id)
  }

  const onOpenManageDocuments = (assignment: TeacherAssignment) => {
    setSelectedAssignmentId(assignment.id)
    setSelectedAssignmentTitle(assignment.title)
    setSelectedDocuments([])
    setOpenDocumentsDialog(true)
    docsByAssignmentMutation.mutate(assignment.id)
  }

  const onOpenManageTestCases = (assignment: TeacherAssignment) => {
    setSelectedAssignmentId(assignment.id)
    setSelectedAssignmentTitle(assignment.title)
    setSelectedTestCases([])
    setOpenTestCasesDialog(true)
    testCasesByAssignmentMutation.mutate(assignment.id)
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Teacher Assignment Management</h1>
          <p className="text-sm text-muted-foreground">Create, update, and manage assignment documents.</p>
        </div>

        <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Create Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Assignment</DialogTitle>
              <DialogDescription>Fill assignment information and upload an optional document.</DialogDescription>
            </DialogHeader>
            <form onSubmit={onCreateSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-title">Title</Label>
                <Input id="create-title" value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-description">Description</Label>
                <textarea
                  id="create-description"
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <div className="space-y-2">
                  <Label htmlFor="create-deadline">Deadline</Label>
                  <Input
                    id="create-deadline"
                    type="datetime-local"
                    value={createDeadline}
                    onChange={(event) => setCreateDeadline(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-status">Status</Label>
                  <select
                    id="create-status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={createStatus}
                    onChange={(event) => setCreateStatus(event.target.value as 'open' | 'closed')}
                  >
                    <option value="open">open</option>
                    <option value="closed">closed</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-max-score">Max Score</Label>
                <Input
                  id="create-max-score"
                  type="number"
                  min={1}
                  value={createMaxScore}
                  onChange={(event) => setCreateMaxScore(Number(event.target.value))}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="create-criteria">Evaluation Criteria</Label>
                <textarea
                  id="create-criteria"
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={createCriteria}
                  onChange={(event) => setCreateCriteria(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Test Cases</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCreateTestCases((prev) => [
                        ...prev,
                        { input: '', expectedOutput: '', isSample: false, weight: 1 },
                      ])
                    }
                  >
                    Add test case
                  </Button>
                </div>
                {createTestCases.map((testCase, index) => (
                  <div key={`create-test-case-${index}`} className="space-y-3 rounded-md border p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Input</Label>
                        <Input
                          value={testCase.input}
                          onChange={(event) =>
                            setCreateTestCases((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, input: event.target.value } : item,
                              ),
                            )
                          }
                          placeholder="1 2 3"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Output</Label>
                        <Input
                          value={testCase.expectedOutput}
                          onChange={(event) =>
                            setCreateTestCases((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, expectedOutput: event.target.value } : item,
                              ),
                            )
                          }
                          placeholder="2"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Weight</Label>
                        <Input
                          type="number"
                          min={1}
                          value={testCase.weight}
                          onChange={(event) =>
                            setCreateTestCases((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, weight: Number(event.target.value) || 1 } : item,
                              ),
                            )
                          }
                          required
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm md:self-end">
                        <input
                          type="checkbox"
                          checked={testCase.isSample}
                          onChange={(event) =>
                            setCreateTestCases((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, isSample: event.target.checked } : item,
                              ),
                            )
                          }
                        />
                        Sample test case
                      </label>
                    </div>

                    {createTestCases.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setCreateTestCases((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-document">Document (PDF)</Label>
                <Input
                  id="create-document"
                  type="file"
                  accept=".pdf"
                  onChange={(event) => setCreateFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm md:self-end">
                <input
                  type="checkbox"
                  checked={createAllowLate}
                  onChange={(event) => setCreateAllowLate(event.target.checked)}
                />
                Allow late submission
              </label>
              <DialogFooter className="md:col-span-2">
                <Button type="submit" disabled={createMutation.isPending || !accessToken}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create assignment'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignment Management</CardTitle>
          <CardDescription>Your assignments displayed as clean management cards.</CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading assignments...</p> : null}
          {assignmentsQuery.isError ? <p className="text-sm text-destructive">{assignmentsQuery.error.message}</p> : null}

          {assignmentsQuery.isSuccess ? (
            <div className="grid gap-4 md:grid-cols-2">
              {assignmentsQuery.data.data.map((assignment) => (
                <div key={assignment.id} className="rounded-xl border p-4 transition-shadow hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold leading-tight">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Deadline: {new Date(assignment.deadline).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={assignment.status === 'open' ? 'default' : 'outline'}>{assignment.status}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{assignment.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => onOpenManageAssignment(assignment)}>
                      Manage Assignment
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onOpenManageDocuments(assignment)}>
                      Manage Documents
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onOpenManageTestCases(assignment)}>
                      Manage Test Cases
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document Management</CardTitle>
          <CardDescription>All assignment documents in one professional list.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {allDocsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading documents...</p> : null}
          {allDocsQuery.isError ? <p className="text-sm text-destructive">{allDocsQuery.error.message}</p> : null}
          {allDocsQuery.isSuccess && allDocsQuery.data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents available.</p>
          ) : null}
          {allDocsQuery.isSuccess
            ? allDocsQuery.data.data.map((doc) => (
                <div
                  key={`${doc.assignmentId}-${doc.fileName}-${doc.fileUrl}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{doc.assignmentTitle ?? 'Assignment document'}</p>
                    <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                  </div>
                  <DocumentPreviewDialog fileUrl={doc.fileUrl} fileName={doc.fileName} />
                </div>
              ))
            : null}
        </CardContent>
      </Card>

      <Dialog
        open={openAssignmentDialog}
        onOpenChange={(open) => {
          setOpenAssignmentDialog(open)
          if (!open) {
            setSelectedAssignmentId(null)
            setSelectedAssignmentTitle('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Assignment</DialogTitle>
            <DialogDescription>Update assignment information for: {selectedAssignmentTitle || 'N/A'}</DialogDescription>
          </DialogHeader>
          {detailsMutation.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading assignment details...
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (!selectedAssignmentId) return
                updateMutation.mutate({
                  assignmentId: selectedAssignmentId,
                  payload: {
                    ...manageForm,
                    deadline: new Date(manageForm.deadline).toISOString(),
                  },
                })
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" name="title" value={manageForm.title} onChange={(event) => setManageForm((prev) => ({ ...prev, title: event.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <textarea
                  id="edit-description"
                  name="description"
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={manageForm.description}
                  onChange={(event) => setManageForm((prev) => ({ ...prev, description: event.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-deadline">Deadline</Label>
                  <Input
                    id="edit-deadline"
                    name="deadline"
                    type="datetime-local"
                    value={manageForm.deadline}
                    onChange={(event) => setManageForm((prev) => ({ ...prev, deadline: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <select
                    id="edit-status"
                    name="status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={manageForm.status}
                    onChange={(event) => setManageForm((prev) => ({ ...prev, status: event.target.value as 'open' | 'closed' }))}
                  >
                    <option value="open">open</option>
                    <option value="closed">closed</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-max-score">Max Score</Label>
                <Input
                  id="edit-max-score"
                  name="maxScore"
                  type="number"
                  min={1}
                  value={manageForm.maxScore}
                  onChange={(event) => setManageForm((prev) => ({ ...prev, maxScore: Number(event.target.value) }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-criteria">Evaluation Criteria</Label>
                <textarea
                  id="edit-criteria"
                  name="evaluationCriteria"
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={manageForm.evaluationCriteria}
                  onChange={(event) => setManageForm((prev) => ({ ...prev, evaluationCriteria: event.target.value }))}
                  required
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={manageForm.allowLateSubmission}
                  onChange={(event) => setManageForm((prev) => ({ ...prev, allowLateSubmission: event.target.checked }))}
                />
                Allow late submission
              </label>

              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending || !accessToken}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update assignment'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={openDocumentsDialog}
        onOpenChange={(open) => {
          setOpenDocumentsDialog(open)
          if (!open) {
            setSelectedAssignmentId(null)
            setSelectedAssignmentTitle('')
            setSelectedDocuments([])
            setManageDocumentFile(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Documents</DialogTitle>
            <DialogDescription>Assignment: {selectedAssignmentTitle || 'N/A'}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="manage-doc-upload">Add Document</Label>
            <Input
              id="manage-doc-upload"
              type="file"
              accept=".pdf"
              onChange={(event) => setManageDocumentFile(event.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!manageDocumentFile || uploadDocMutation.isPending || !selectedAssignmentId}
              onClick={() => {
                if (!manageDocumentFile || !selectedAssignmentId) return
                uploadDocMutation.mutate({ assignmentId: selectedAssignmentId, file: manageDocumentFile })
                setManageDocumentFile(null)
              }}
            >
              <Upload className="h-4 w-4" />
              {uploadDocMutation.isPending ? 'Uploading...' : 'Upload document'}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Documents for this assignment</p>
            {docsByAssignmentMutation.isPending ? <p className="text-sm text-muted-foreground">Loading documents...</p> : null}
            {selectedDocuments.length === 0 ? <p className="text-sm text-muted-foreground">No documents found.</p> : null}
            {selectedDocuments.map((doc) => (
              <div key={`${doc.fileUrl}-${doc.fileName}`} className="rounded-md border p-2 text-sm">
                <p className="font-medium">{doc.fileName}</p>
                <DocumentPreviewDialog fileUrl={doc.fileUrl} fileName={doc.fileName} />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openTestCasesDialog}
        onOpenChange={(open) => {
          setOpenTestCasesDialog(open)
          if (!open) {
            setSelectedAssignmentId(null)
            setSelectedAssignmentTitle('')
            setSelectedTestCases([])
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Test Cases</DialogTitle>
            <DialogDescription>Assignment: {selectedAssignmentTitle || 'N/A'}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {testCasesByAssignmentMutation.isPending ? (
              <p className="text-sm text-muted-foreground">Loading test cases...</p>
            ) : null}
            {selectedTestCases.length === 0 ? <p className="text-sm text-muted-foreground">No test cases found.</p> : null}

            {selectedTestCases.map((testCase) => (
              <div key={testCase.id ?? `${testCase.orderIndex}-${testCase.input}`} className="rounded-md border p-3 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">#{testCase.orderIndex}</Badge>
                  <Badge variant={testCase.isSample ? 'default' : 'secondary'}>
                    {testCase.isSample ? 'sample' : 'hidden'}
                  </Badge>
                  <Badge variant="outline">weight: {testCase.weight}</Badge>
                </div>
                <p>
                  <span className="font-medium">Input:</span> {testCase.input}
                </p>
                <p>
                  <span className="font-medium">Expected:</span> {testCase.expectedOutput ?? '(hidden)'}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
