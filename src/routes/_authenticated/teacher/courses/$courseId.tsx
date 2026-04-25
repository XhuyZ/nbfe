import { useState, type FormEvent, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Plus, Upload } from 'lucide-react'
import { toast } from 'react-toastify'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DocumentPreviewDialog } from '@/components/document-preview-dialog'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    createCourseChapter,
    getCourseById,
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

export const Route = createFileRoute('/_authenticated/teacher/courses/$courseId')({
    component: ManageCoursePage,
})

function ManageCoursePage() {
    const { courseId } = useParams({ from: '/_authenticated/teacher/courses/$courseId' })
    const queryClient = useQueryClient()
    const { accessToken } = useAuth()

    const [selectedCourse, setSelectedCourse] = useState<CourseItem | null>(null)
    const [selectedChapters, setSelectedChapters] = useState<CourseChapter[]>([])
    const [chapterTitle, setChapterTitle] = useState('')

    const [openCreateAssignment, setOpenCreateAssignment] = useState(false)
    const [chapterForCreateAssignment, setChapterForCreateAssignment] = useState<CourseChapter | null>(null)
    const [openAssignmentDialog, setOpenAssignmentDialog] = useState(false)
    const [openAssignmentViewDialog, setOpenAssignmentViewDialog] = useState(false)
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

    // Queries
    const courseQuery = useQuery({
        queryKey: ['teacher-course-detail', courseId, accessToken],
        enabled: Boolean(accessToken && courseId),
        queryFn: async () => getCourseById(accessToken!, courseId),
    })

    useEffect(() => {
        if (courseQuery.data?.data) {
            setSelectedCourse(courseQuery.data.data)
            setSelectedChapters(courseQuery.data.data.chapters ?? [])
        }
    }, [courseQuery.data])

    const chapterAssignmentIds = Array.from(
        new Set(
            selectedChapters
                .map((chapter) => chapter.assignmentId)
                .filter((assignmentId): assignmentId is string => Boolean(assignmentId)),
        ),
    )

    const assignmentTitleQuery = useQuery<Record<string, string>, Error>({
        queryKey: ['chapter-assignment-titles', accessToken, chapterAssignmentIds.join(',')],
        enabled: Boolean(accessToken && chapterAssignmentIds.length > 0),
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

    // Mutations
    const createChapterMutation = useMutation({
        mutationFn: async () => createCourseChapter(accessToken!, courseId, { title: chapterTitle }),
        onSuccess: async (result) => {
            toast.success(result.message)
            setChapterTitle('')
            await queryClient.invalidateQueries({ queryKey: ['teacher-course-detail', courseId] })
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
            // Reset form
            setCreateAssignmentTitle('')
            setCreateAssignmentDescription('')
            setCreateAssignmentDeadline('')
            setCreateAssignmentStatus('open')
            setCreateAssignmentMaxScore(100)
            setCreateAssignmentCriteria('')
            setCreateAssignmentAllowLate(false)
            setCreateAssignmentFile(null)
            setCreateAssignmentTestCases([{ input: '', expectedOutput: '', isSample: true, weight: 1 }])
            await queryClient.invalidateQueries({ queryKey: ['teacher-course-detail', courseId] })
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
            queryClient.invalidateQueries({ queryKey: ['teacher-course-detail', courseId] })
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
            queryClient.invalidateQueries({ queryKey: ['teacher-course-detail', courseId] })
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : 'Update assignment failed'),
    })

    // Handlers
    const onCreateChapter = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
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

    if (courseQuery.isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    return (
        <section className="space-y-6">
            <div className="flex items-center gap-4">
                <Link to="/teacher/courses" className="rounded-full p-2 transition hover:bg-slate-100">
                    <ArrowLeft className="h-6 w-6 text-slate-600" />
                </Link>
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight">Manage Course</h1>
                    <p className="text-sm text-muted-foreground">{selectedCourse?.name ?? 'Course details'}</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-1">
                    <Card className="rounded-2xl border-slate-200">
                        <CardContent className="p-6">
                            <h3 className="mb-4 text-lg font-semibold">Course Details</h3>
                            <div className="space-y-4 text-sm">
                                <div>
                                    <Label className="text-slate-500">Name</Label>
                                    <p className="mt-1 font-medium">{selectedCourse?.name}</p>
                                </div>
                                <div>
                                    <Label className="text-slate-500">Description</Label>
                                    <p className="mt-1 text-slate-600 leading-relaxed">{selectedCourse?.description}</p>
                                </div>
                                <div className="pt-2">
                                    <Badge
                                        className={
                                            selectedCourse?.isPublished
                                                ? 'border-0 bg-emerald-50 text-emerald-600 hover:bg-emerald-50'
                                                : 'border-0 bg-slate-100 text-slate-500 hover:bg-slate-100'
                                        }
                                    >
                                        {selectedCourse?.isPublished ? 'Published' : 'Draft'}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200">
                        <CardContent className="p-6">
                            <h3 className="mb-4 text-lg font-semibold">Add New Chapter</h3>
                            <form className="space-y-4" onSubmit={onCreateChapter}>
                                <div className="space-y-2">
                                    <Label htmlFor="chapter-title">Chapter Title</Label>
                                    <Input
                                        id="chapter-title"
                                        value={chapterTitle}
                                        onChange={(event) => setChapterTitle(event.target.value)}
                                        placeholder="e.g. Introduction to Variables"
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={createChapterMutation.isPending}>
                                    {createChapterMutation.isPending ? 'Adding...' : 'Add Chapter'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6 lg:col-span-2">
                    <Card className="rounded-2xl border-slate-200">
                        <CardContent className="p-6">
                            <div className="mb-6 flex items-center justify-between">
                                <h3 className="text-lg font-semibold">Chapters & Assignments</h3>
                                <Badge variant="outline" className="px-3 py-1">
                                    {selectedChapters.length} Chapters
                                </Badge>
                            </div>

                            {selectedChapters.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 py-12 text-center">
                                    <p className="text-sm text-slate-400">No chapters yet. Start by adding one in the sidebar.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {selectedChapters.map((chapter, index) => (
                                        <div key={chapter.id} className="group relative rounded-2xl border border-slate-100 bg-white p-5 transition hover:border-slate-200 hover:shadow-sm">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-xs font-bold text-slate-400">
                                                            #{index + 1}
                                                        </span>
                                                        <h4 className="font-semibold text-slate-900">{chapter.title}</h4>
                                                    </div>

                                                    <div className="mt-4">
                                                        {chapter.assignmentId ? (
                                                            <div className="rounded-xl bg-blue-50/50 p-4">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-medium uppercase tracking-wider text-blue-500/70">Linked Assignment</p>
                                                                        <p className="mt-1 truncate font-medium text-slate-900">
                                                                            {assignmentTitleQuery.data?.[chapter.assignmentId] ?? 'Loading...'}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex shrink-0 gap-2">
                                                                        <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" onClick={() => onOpenAssignmentDetail(chapter)}>
                                                                            View Details
                                                                        </Button>
                                                                        <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => onOpenManageAssignment(chapter)}>
                                                                            Edit
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center rounded-xl bg-slate-50/50 py-6">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                                    onClick={() => onOpenCreateAssignment(chapter)}
                                                                >
                                                                    <Plus className="mr-2 h-4 w-4" />
                                                                    Create assignment for this chapter
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Dialogs migrated from index page */}
            <Dialog
                open={openCreateAssignment}
                onOpenChange={(open) => {
                    setOpenCreateAssignment(open)
                    if (!open) setChapterForCreateAssignment(null)
                }}
            >
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Assignment</DialogTitle>
                        <DialogDescription>
                            {chapterForCreateAssignment ? `Chapter: ${chapterForCreateAssignment.title}` : 'Select a chapter'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={onCreateAssignmentSubmit} className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input value={createAssignmentTitle} onChange={(e) => setCreateAssignmentTitle(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Score</Label>
                                <Input type="number" value={createAssignmentMaxScore} onChange={(e) => setCreateAssignmentMaxScore(Number(e.target.value))} required />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:border-blue-400"
                                value={createAssignmentDescription} onChange={(e) => setCreateAssignmentDescription(e.target.value)} required />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Deadline</Label>
                                <Input type="datetime-local" value={createAssignmentDeadline} onChange={(e) => setCreateAssignmentDeadline(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <select className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                                    value={createAssignmentStatus} onChange={(e) => setCreateAssignmentStatus(e.target.value as any)}>
                                    <option value="open">Open</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Evaluation Criteria</Label>
                            <textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:border-blue-400"
                                value={createAssignmentCriteria} onChange={(e) => setCreateAssignmentCriteria(e.target.value)} required />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-bold">Test Cases</Label>
                                <Button type="button" variant="outline" size="sm"
                                    onClick={() => setCreateAssignmentTestCases([...createAssignmentTestCases, { input: '', expectedOutput: '', isSample: false, weight: 1 }])}>
                                    Add Test Case
                                </Button>
                            </div>
                            {createAssignmentTestCases.map((tc, idx) => (
                                <div key={idx} className="rounded-xl border border-slate-100 p-4 space-y-3">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Input placeholder="Input" value={tc.input} onChange={(e) => {
                                            const next = [...createAssignmentTestCases]; next[idx].input = e.target.value; setCreateAssignmentTestCases(next);
                                        }} required />
                                        <Input placeholder="Expected Output" value={tc.expectedOutput} onChange={(e) => {
                                            const next = [...createAssignmentTestCases]; next[idx].expectedOutput = e.target.value; setCreateAssignmentTestCases(next);
                                        }} required />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Input type="number" className="w-24" value={tc.weight} onChange={(e) => {
                                                const next = [...createAssignmentTestCases]; next[idx].weight = Number(e.target.value); setCreateAssignmentTestCases(next);
                                            }} required />
                                            <Label className="flex items-center gap-2 text-xs">
                                                <input type="checkbox" checked={tc.isSample} onChange={(e) => {
                                                    const next = [...createAssignmentTestCases]; next[idx].isSample = e.target.checked; setCreateAssignmentTestCases(next);
                                                }} /> Sample
                                            </Label>
                                        </div>
                                        {createAssignmentTestCases.length > 1 && (
                                            <Button type="button" variant="ghost" size="sm" className="text-rose-500"
                                                onClick={() => setCreateAssignmentTestCases(createAssignmentTestCases.filter((_, i) => i !== idx))}>
                                                Remove
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                            <div className="space-y-1">
                                <Label className="text-xs">Document (PDF)</Label>
                                <Input type="file" accept=".pdf" className="h-9 text-xs" onChange={(e) => setCreateAssignmentFile(e.target.files?.[0] ?? null)} />
                            </div>
                            <Label className="flex items-center gap-2 text-xs">
                                <input type="checkbox" checked={createAssignmentAllowLate} onChange={(e) => setCreateAssignmentAllowLate(e.target.checked)} />
                                Allow Late Submission
                            </Label>
                        </div>

                        <DialogFooter>
                            <Button type="submit" className="w-full" disabled={createAssignmentMutation.isPending}>
                                {createAssignmentMutation.isPending ? 'Creating...' : 'Create Assignment'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={openAssignmentViewDialog} onOpenChange={setOpenAssignmentViewDialog}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Assignment Details</DialogTitle>
                    </DialogHeader>
                    {detailsMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin m-auto" /> : selectedAssignmentDetail && (
                        <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-3">
                                <Card className="p-4 bg-slate-50/50 border-none">
                                    <p className="text-xs text-slate-500 uppercase">Max Score</p>
                                    <p className="text-lg font-bold">{selectedAssignmentDetail.maxScore}</p>
                                </Card>
                                <Card className="p-4 bg-slate-50/50 border-none">
                                    <p className="text-xs text-slate-500 uppercase">Status</p>
                                    <Badge variant={selectedAssignmentDetail.status === 'open' ? 'default' : 'secondary'}>
                                        {selectedAssignmentDetail.status}
                                    </Badge>
                                </Card>
                                <Card className="p-4 bg-slate-50/50 border-none">
                                    <p className="text-xs text-slate-500 uppercase">Deadline</p>
                                    <p className="text-sm font-bold">{new Date(selectedAssignmentDetail.deadline).toLocaleString()}</p>
                                </Card>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold">Description</h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/30 p-4 rounded-xl">{selectedAssignmentDetail.description}</p>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-bold">Documents</h4>
                                {selectedDocuments.map((doc, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 border rounded-xl">
                                        <span className="text-sm font-medium">{doc.fileName}</span>
                                        <DocumentPreviewDialog fileUrl={doc.fileUrl} fileName={doc.fileName} />
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-bold">Test Cases</h4>
                                <div className="grid gap-3 md:grid-cols-2">
                                    {selectedTestCases.map((tc, idx) => (
                                        <div key={idx} className="p-4 border rounded-xl space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline">#{tc.orderIndex}</Badge>
                                                <Badge variant={tc.isSample ? 'default' : 'outline'}>{tc.isSample ? 'Sample' : 'Hidden'}</Badge>
                                            </div>
                                            <p className="text-sm"><span className="text-slate-400">Input:</span> {tc.input}</p>
                                            <p className="text-sm"><span className="text-slate-400">Expected:</span> {tc.expectedOutput || '(Hidden)'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={openAssignmentDialog} onOpenChange={setOpenAssignmentDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Assignment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                        <div className="space-y-4 p-4 border rounded-xl">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input value={manageForm.title} onChange={(e) => setManageForm({ ...manageForm, title: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-4 text-sm"
                                    value={manageForm.description} onChange={(e) => setManageForm({ ...manageForm, description: e.target.value })} />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Input type="datetime-local" value={manageForm.deadline} onChange={(e) => setManageForm({ ...manageForm, deadline: e.target.value })} />
                                <select className="rounded-xl border border-slate-200 px-3 text-sm"
                                    value={manageForm.status} onChange={(e) => setManageForm({ ...manageForm, status: e.target.value as any })}>
                                    <option value="open">Open</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>
                            <Button className="w-full" onClick={() => updateMutation.mutate({ assignmentId: selectedAssignmentId!, payload: manageForm })} disabled={updateMutation.isPending}>
                                Save Changes
                            </Button>
                        </div>

                        <div className="p-4 border rounded-xl space-y-4">
                            <Label className="font-bold">Add Document</Label>
                            <div className="flex gap-4">
                                <Input type="file" accept=".pdf" onChange={(e) => setManageDocumentFile(e.target.files?.[0] ?? null)} />
                                <Button disabled={!manageDocumentFile || uploadDocMutation.isPending} onClick={() => uploadDocMutation.mutate({ assignmentId: selectedAssignmentId!, file: manageDocumentFile! })}>
                                    Upload
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    )
}
