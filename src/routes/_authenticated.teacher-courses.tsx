import { useState, type FormEvent } from 'react'
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
  createCourse,
  createCourseChapter,
  getCourseById,
  getTeachingCourses,
  type CourseChapter,
  type CourseItem,
} from '@/lib/courses-api'
import {
  type AssignmentDocument,
  type AssignmentTestCase,
  type TeacherAssignment,
  createAssignment,
  getAssignmentDetails,
  getAssignmentDocuments,
  getAssignmentTestCases,
  updateAssignment,
  type UpdateAssignmentPayload,
} from '@/lib/teacher-assignments-api'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/teacher-courses')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'teacher') {
      throw redirect({ to: `/${role}` as '/student' | '/admin' })
    }
  },
  component: TeacherCoursesPage,
})

function TeacherCoursesPage() {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()
  const [openCreateCourse, setOpenCreateCourse] = useState(false)
  const [openManageCourse, setOpenManageCourse] = useState(false)
  const [courseName, setCourseName] = useState('')
  const [courseDescription, setCourseDescription] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<CourseItem | null>(null)
  const [selectedChapters, setSelectedChapters] = useState<CourseChapter[]>([])
  const [chapterTitle, setChapterTitle] = useState('')
  const [openCreateAssignment, setOpenCreateAssignment] = useState(false)
  const [chapterForCreateAssignment, setChapterForCreateAssignment] = useState<CourseChapter | null>(null)
  const [openAssignmentDialog, setOpenAssignmentDialog] = useState(false)
  const [openAssignmentViewDialog, setOpenAssignmentViewDialog] = useState(false)
  const [openDocumentsDialog, setOpenDocumentsDialog] = useState(false)
  const [openTestCasesDialog, setOpenTestCasesDialog] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  const [selectedAssignmentTitle, setSelectedAssignmentTitle] = useState('')
  const [selectedAssignmentDetail, setSelectedAssignmentDetail] = useState<TeacherAssignment | null>(null)
  const [selectedDocuments, setSelectedDocuments] = useState<AssignmentDocument[]>([])
  const [selectedTestCases, setSelectedTestCases] = useState<AssignmentTestCase[]>([])
  const [manageDocumentFile, setManageDocumentFile] = useState<File | null>(null)

  const [createAssignmentTitle, setCreateAssignmentTitle] = useState('')
  const [createAssignmentDescription, setCreateAssignmentDescription] = useState('')
  const [createAssignmentDeadline, setCreateAssignmentDeadline] = useState('')
  const [createAssignmentStatus, setCreateAssignmentStatus] = useState<'open' | 'closed'>('open')
  const [createAssignmentMaxScore, setCreateAssignmentMaxScore] = useState(100)
  const [createAssignmentCriteria, setCreateAssignmentCriteria] = useState('')
  const [createAssignmentAllowLate, setCreateAssignmentAllowLate] = useState(false)
  const [createAssignmentFile, setCreateAssignmentFile] = useState<File | null>(null)
  const [createAssignmentTestCases, setCreateAssignmentTestCases] = useState<
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

  const coursesQuery = useQuery<{ message: string; data: CourseItem[] }, Error>({
    queryKey: ['teacher-courses', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getTeachingCourses(accessToken!),
  })
  const chapterAssignmentIds = Array.from(
    new Set(
      selectedChapters
        .map((chapter) => chapter.assignmentId)
        .filter((assignmentId): assignmentId is string => Boolean(assignmentId)),
    ),
  )
  const assignmentTitleQuery = useQuery<Record<string, string>, Error>({
    queryKey: ['chapter-assignment-titles', accessToken, chapterAssignmentIds.join(',')],
    enabled: Boolean(accessToken && openManageCourse && chapterAssignmentIds.length > 0),
    queryFn: async () => {
      const entries = await Promise.all(
        chapterAssignmentIds.map(async (assignmentId) => {
          const result = await getAssignmentDetails(accessToken!, assignmentId)
          return [assignmentId, result.data.title] as const
        }),
      )
      return Object.fromEntries(entries)
    },
  })

  const createCourseMutation = useMutation({
    mutationFn: async () => createCourse(accessToken!, { name: courseName, description: courseDescription }),
    onSuccess: async (result) => {
      toast.success(result.message)
      setCourseName('')
      setCourseDescription('')
      setOpenCreateCourse(false)
      await queryClient.invalidateQueries({ queryKey: ['teacher-courses'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Create course failed'),
  })

  const courseDetailMutation = useMutation({
    mutationFn: async (courseId: string) => getCourseById(accessToken!, courseId),
    onSuccess: (result) => {
      setSelectedCourse(result.data)
      setSelectedChapters(result.data.chapters ?? [])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Load course detail failed'),
  })

  const createChapterMutation = useMutation({
    mutationFn: async () => createCourseChapter(accessToken!, selectedCourseId!, { title: chapterTitle }),
    onSuccess: async (result) => {
      toast.success(result.message)
      setChapterTitle('')
      if (selectedCourseId) {
        courseDetailMutation.mutate(selectedCourseId)
      }
      await queryClient.invalidateQueries({ queryKey: ['teacher-courses'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Create chapter failed'),
  })

  const createAssignmentMutation = useMutation({
    mutationFn: async () =>
      createAssignment(accessToken!, {
        chapterId: chapterForCreateAssignment!.id,
        title: createAssignmentTitle,
        description: createAssignmentDescription,
        deadline: new Date(createAssignmentDeadline).toISOString(),
        status: createAssignmentStatus,
        maxScore: createAssignmentMaxScore,
        testCases: createAssignmentTestCases.map((testCase, index) => ({
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          isSample: testCase.isSample,
          weight: testCase.weight,
          orderIndex: index + 1,
        })),
        evaluationCriteria: createAssignmentCriteria,
        allowLateSubmission: createAssignmentAllowLate,
        document: createAssignmentFile,
      }),
    onSuccess: async (result) => {
      toast.success(result.message)
      setOpenCreateAssignment(false)
      setChapterForCreateAssignment(null)
      setCreateAssignmentTitle('')
      setCreateAssignmentDescription('')
      setCreateAssignmentDeadline('')
      setCreateAssignmentStatus('open')
      setCreateAssignmentMaxScore(100)
      setCreateAssignmentCriteria('')
      setCreateAssignmentAllowLate(false)
      setCreateAssignmentFile(null)
      setCreateAssignmentTestCases([{ input: '', expectedOutput: '', isSample: true, weight: 1 }])
      if (selectedCourseId) {
        courseDetailMutation.mutate(selectedCourseId)
      }
      await queryClient.invalidateQueries({ queryKey: ['teacher-courses'] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Create assignment failed'),
  })

  const detailsMutation = useMutation({
    mutationFn: async (assignmentId: string) => getAssignmentDetails(accessToken!, assignmentId),
    onSuccess: (result) => {
      setSelectedAssignmentTitle(result.data.title)
      setSelectedAssignmentDetail(result.data)
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
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Load assignment details failed'),
  })

  const docsByAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => getAssignmentDocuments(accessToken!, assignmentId),
    onSuccess: (result) => {
      setSelectedDocuments(result.data)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Load assignment documents failed'),
  })

  const testCasesByAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => getAssignmentTestCases(accessToken!, assignmentId),
    onSuccess: (result) => {
      setSelectedTestCases(result.data)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Load assignment test cases failed'),
  })

  const uploadDocMutation = useMutation({
    mutationFn: async (params: { assignmentId: string; file: File }) => {
      const mod = await import('@/lib/teacher-assignments-api')
      return mod.addAssignmentDocument(accessToken!, params.assignmentId, params.file)
    },
    onSuccess: (result) => {
      toast.success(result.message)
      if (selectedAssignmentId) {
        docsByAssignmentMutation.mutate(selectedAssignmentId)
      }
      if (selectedCourseId) {
        courseDetailMutation.mutate(selectedCourseId)
      }
      setManageDocumentFile(null)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Upload document failed'),
  })

  const updateMutation = useMutation({
    mutationFn: async (params: { assignmentId: string; payload: UpdateAssignmentPayload }) =>
      updateAssignment(accessToken!, params.assignmentId, params.payload),
    onSuccess: (result) => {
      toast.success(result.message)
      if (selectedAssignmentId) {
        detailsMutation.mutate(selectedAssignmentId)
      }
      if (selectedCourseId) {
        courseDetailMutation.mutate(selectedCourseId)
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Update assignment failed'),
  })

  const onOpenManage = (course: CourseItem) => {
    setSelectedCourseId(course.id)
    setOpenManageCourse(true)
    setSelectedCourse(null)
    setSelectedChapters([])
    courseDetailMutation.mutate(course.id)
  }

  const onCreateCourse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createCourseMutation.mutate()
  }

  const onCreateChapter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedCourseId) return
    createChapterMutation.mutate()
  }

  const onCreateAssignmentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!chapterForCreateAssignment) return
    createAssignmentMutation.mutate()
  }

  const onOpenCreateAssignment = (chapter: CourseChapter) => {
    setChapterForCreateAssignment(chapter)
    setCreateAssignmentTitle('')
    setCreateAssignmentDescription('')
    setCreateAssignmentDeadline('')
    setCreateAssignmentStatus('open')
    setCreateAssignmentMaxScore(100)
    setCreateAssignmentCriteria('')
    setCreateAssignmentAllowLate(false)
    setCreateAssignmentFile(null)
    setCreateAssignmentTestCases([{ input: '', expectedOutput: '', isSample: true, weight: 1 }])
    setOpenCreateAssignment(true)
  }

  const onOpenAssignmentDetail = (chapter: CourseChapter) => {
    if (!chapter.assignmentId) return
    setSelectedAssignmentId(chapter.assignmentId)
    setSelectedAssignmentTitle(assignmentTitleQuery.data?.[chapter.assignmentId] ?? `Assignment for chapter: ${chapter.title}`)
    setSelectedAssignmentDetail(null)
    setSelectedDocuments([])
    setSelectedTestCases([])
    setOpenAssignmentViewDialog(true)
    detailsMutation.mutate(chapter.assignmentId)
    docsByAssignmentMutation.mutate(chapter.assignmentId)
    testCasesByAssignmentMutation.mutate(chapter.assignmentId)
  }

  const onOpenManageAssignment = (chapter: CourseChapter) => {
    if (!chapter.assignmentId) return
    setSelectedAssignmentId(chapter.assignmentId)
    setSelectedAssignmentTitle(assignmentTitleQuery.data?.[chapter.assignmentId] ?? `Assignment for chapter: ${chapter.title}`)
    setSelectedAssignmentDetail(null)
    setOpenAssignmentDialog(true)
    detailsMutation.mutate(chapter.assignmentId)
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Course Management</h1>
          <p className="text-sm text-muted-foreground">Create courses, manage chapters, and control chapter assignments in one place.</p>
        </div>

        <Dialog open={openCreateCourse} onOpenChange={setOpenCreateCourse}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Create Course
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Course</DialogTitle>
              <DialogDescription>Create a new teaching course.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={onCreateCourse}>
              <div className="space-y-2">
                <Label htmlFor="course-name">Course name</Label>
                <Input
                  id="course-name"
                  value={courseName}
                  onChange={(event) => setCourseName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-description">Description</Label>
                <textarea
                  id="course-description"
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={courseDescription}
                  onChange={(event) => setCourseDescription(event.target.value)}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createCourseMutation.isPending || !accessToken}>
                  {createCourseMutation.isPending ? 'Creating...' : 'Create course'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Teaching Courses</CardTitle>
          <CardDescription>Courses assigned to your teacher account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {coursesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading courses...</p> : null}
          {coursesQuery.isError ? <p className="text-sm text-destructive">{coursesQuery.error.message}</p> : null}
          {coursesQuery.isSuccess && coursesQuery.data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No courses found.</p>
          ) : null}

          {coursesQuery.isSuccess
            ? coursesQuery.data.data.map((course) => (
                <div key={course.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{course.name}</p>
                      <p className="text-xs text-muted-foreground">{course.description}</p>
                    </div>
                    <Badge variant={course.isPublished ? 'default' : 'outline'}>
                      {course.isPublished ? 'published' : 'draft'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Chapters: {course.chapters.length}</p>
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={() => onOpenManage(course)}>
                      Manage course
                    </Button>
                  </div>
                </div>
              ))
            : null}
        </CardContent>
      </Card>

      <Dialog
        open={openManageCourse}
        onOpenChange={(open) => {
          setOpenManageCourse(open)
          if (!open) {
            setSelectedCourseId(null)
            setSelectedCourse(null)
            setSelectedChapters([])
            setChapterTitle('')
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Manage Course</DialogTitle>
            <DialogDescription>{selectedCourse?.name ?? 'Loading course detail...'}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedCourse ? (
              <div className="rounded-md border p-3 text-sm">
                <p>
                  <span className="font-medium">Course:</span> {selectedCourse.name}
                </p>
                <p>
                  <span className="font-medium">Description:</span> {selectedCourse.description}
                </p>
              </div>
            ) : null}

            <form className="space-y-2 rounded-md border p-3" onSubmit={onCreateChapter}>
              <Label htmlFor="chapter-title">Create chapter</Label>
              <div className="flex gap-2">
                <Input
                  id="chapter-title"
                  value={chapterTitle}
                  onChange={(event) => setChapterTitle(event.target.value)}
                  placeholder="Chapter title"
                  required
                />
                <Button type="submit" disabled={createChapterMutation.isPending || !selectedCourseId}>
                  {createChapterMutation.isPending ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </form>

            <div className="space-y-2">
              <p className="text-sm font-medium">Chapters</p>
              {courseDetailMutation.isPending ? <p className="text-sm text-muted-foreground">Loading chapters...</p> : null}
              {selectedChapters.length === 0 ? <p className="text-sm text-muted-foreground">No chapters yet.</p> : null}
              {selectedChapters.map((chapter) => (
                <div key={chapter.id} className="space-y-3 rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      #{chapter.orderIndex} {chapter.title}
                    </p>
                    <Badge variant="outline">{chapter.assignmentId ? 'has assignment' : 'no assignment'}</Badge>
                  </div>
                  <div className="space-y-2">
                    {chapter.assignmentId ? (
                      <p className="text-xs text-muted-foreground">
                        Assignment: {assignmentTitleQuery.data?.[chapter.assignmentId] ?? 'Loading assignment title...'}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {chapter.assignmentId ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => onOpenAssignmentDetail(chapter)}>
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onOpenManageAssignment(chapter)}>
                          Edit
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => onOpenCreateAssignment(chapter)}>
                        Create Assignment for this chapter
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openCreateAssignment}
        onOpenChange={(open) => {
          setOpenCreateAssignment(open)
          if (!open) {
            setChapterForCreateAssignment(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Assignment</DialogTitle>
            <DialogDescription>
              {chapterForCreateAssignment
                ? `Chapter: #${chapterForCreateAssignment.orderIndex} ${chapterForCreateAssignment.title}`
                : 'Select a chapter first'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateAssignmentSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-assignment-title">Title</Label>
              <Input
                id="create-assignment-title"
                value={createAssignmentTitle}
                onChange={(event) => setCreateAssignmentTitle(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-assignment-description">Description</Label>
              <textarea
                id="create-assignment-description"
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={createAssignmentDescription}
                onChange={(event) => setCreateAssignmentDescription(event.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <div className="space-y-2">
                <Label htmlFor="create-assignment-deadline">Deadline</Label>
                <Input
                  id="create-assignment-deadline"
                  type="datetime-local"
                  value={createAssignmentDeadline}
                  onChange={(event) => setCreateAssignmentDeadline(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-assignment-status">Status</Label>
                <select
                  id="create-assignment-status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={createAssignmentStatus}
                  onChange={(event) => setCreateAssignmentStatus(event.target.value as 'open' | 'closed')}
                >
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-assignment-max-score">Max Score</Label>
              <Input
                id="create-assignment-max-score"
                type="number"
                min={1}
                value={createAssignmentMaxScore}
                onChange={(event) => setCreateAssignmentMaxScore(Number(event.target.value))}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="create-assignment-criteria">Evaluation Criteria</Label>
              <textarea
                id="create-assignment-criteria"
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={createAssignmentCriteria}
                onChange={(event) => setCreateAssignmentCriteria(event.target.value)}
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
                    setCreateAssignmentTestCases((prev) => [...prev, { input: '', expectedOutput: '', isSample: false, weight: 1 }])
                  }
                >
                  Add test case
                </Button>
              </div>
              {createAssignmentTestCases.map((testCase, index) => (
                <div key={`course-create-test-case-${index}`} className="space-y-3 rounded-md border p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Input</Label>
                      <Input
                        value={testCase.input}
                        onChange={(event) =>
                          setCreateAssignmentTestCases((prev) =>
                            prev.map((item, itemIndex) => (itemIndex === index ? { ...item, input: event.target.value } : item)),
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
                          setCreateAssignmentTestCases((prev) =>
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
                          setCreateAssignmentTestCases((prev) =>
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
                          setCreateAssignmentTestCases((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, isSample: event.target.checked } : item,
                            ),
                          )
                        }
                      />
                      Sample test case
                    </label>
                  </div>
                  {createAssignmentTestCases.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCreateAssignmentTestCases((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-assignment-document">Document (PDF)</Label>
              <Input
                id="create-assignment-document"
                type="file"
                accept=".pdf"
                onChange={(event) => setCreateAssignmentFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm md:self-end">
              <input
                type="checkbox"
                checked={createAssignmentAllowLate}
                onChange={(event) => setCreateAssignmentAllowLate(event.target.checked)}
              />
              Allow late submission
            </label>
            <DialogFooter className="md:col-span-2">
              <Button type="submit" disabled={createAssignmentMutation.isPending || !accessToken || !chapterForCreateAssignment}>
                {createAssignmentMutation.isPending ? (
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

      <Dialog
        open={openAssignmentViewDialog}
        onOpenChange={(open) => {
          setOpenAssignmentViewDialog(open)
          if (!open) {
            setSelectedAssignmentId(null)
            setSelectedAssignmentTitle('')
            setSelectedAssignmentDetail(null)
            setSelectedDocuments([])
            setSelectedTestCases([])
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Assignment Detail</DialogTitle>
            <DialogDescription>{selectedAssignmentTitle || 'Loading assignment detail...'}</DialogDescription>
          </DialogHeader>
          {detailsMutation.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading assignment details...
            </div>
          ) : selectedAssignmentDetail ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border p-3">
                <p>
                  <span className="font-medium">Title:</span> {selectedAssignmentDetail.title}
                </p>
                <p>
                  <span className="font-medium">Status:</span> {selectedAssignmentDetail.status}
                </p>
                <p>
                  <span className="font-medium">Max score:</span> {selectedAssignmentDetail.maxScore}
                </p>
                <p>
                  <span className="font-medium">Deadline:</span> {new Date(selectedAssignmentDetail.deadline).toLocaleString()}
                </p>
                <p>
                  <span className="font-medium">Evaluation criteria:</span> {selectedAssignmentDetail.evaluationCriteria}
                </p>
                <p>
                  <span className="font-medium">Description:</span> {selectedAssignmentDetail.description}
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-medium">Documents</p>
                {docsByAssignmentMutation.isPending ? <p className="text-muted-foreground">Loading documents...</p> : null}
                {selectedDocuments.length === 0 ? <p className="text-muted-foreground">No documents found.</p> : null}
                {selectedDocuments.map((doc) => (
                  <div key={`${doc.fileUrl}-${doc.fileName}`} className="rounded-md border p-2">
                    <p className="font-medium">{doc.fileName}</p>
                    <DocumentPreviewDialog fileUrl={doc.fileUrl} fileName={doc.fileName} />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="font-medium">Test Cases</p>
                {testCasesByAssignmentMutation.isPending ? <p className="text-muted-foreground">Loading test cases...</p> : null}
                {selectedTestCases.length === 0 ? <p className="text-muted-foreground">No test cases found.</p> : null}
                {selectedTestCases.map((testCase) => (
                  <div key={testCase.id ?? `${testCase.orderIndex}-${testCase.input}`} className="rounded-md border p-3">
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
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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
                <Label htmlFor="course-edit-title">Title</Label>
                <Input
                  id="course-edit-title"
                  value={manageForm.title}
                  onChange={(event) => setManageForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-edit-description">Description</Label>
                <textarea
                  id="course-edit-description"
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={manageForm.description}
                  onChange={(event) => setManageForm((prev) => ({ ...prev, description: event.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="course-edit-deadline">Deadline</Label>
                  <Input
                    id="course-edit-deadline"
                    type="datetime-local"
                    value={manageForm.deadline}
                    onChange={(event) => setManageForm((prev) => ({ ...prev, deadline: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course-edit-status">Status</Label>
                  <select
                    id="course-edit-status"
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
                <Label htmlFor="course-edit-max-score">Max Score</Label>
                <Input
                  id="course-edit-max-score"
                  type="number"
                  min={1}
                  value={manageForm.maxScore}
                  onChange={(event) => setManageForm((prev) => ({ ...prev, maxScore: Number(event.target.value) }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-edit-criteria">Evaluation Criteria</Label>
                <textarea
                  id="course-edit-criteria"
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
            <Label htmlFor="course-manage-doc-upload">Add Document</Label>
            <Input
              id="course-manage-doc-upload"
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
            {testCasesByAssignmentMutation.isPending ? <p className="text-sm text-muted-foreground">Loading test cases...</p> : null}
            {selectedTestCases.length === 0 ? <p className="text-sm text-muted-foreground">No test cases found.</p> : null}
            {selectedTestCases.map((testCase) => (
              <div key={testCase.id ?? `${testCase.orderIndex}-${testCase.input}`} className="rounded-md border p-3 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">#{testCase.orderIndex}</Badge>
                  <Badge variant={testCase.isSample ? 'default' : 'secondary'}>{testCase.isSample ? 'sample' : 'hidden'}</Badge>
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
