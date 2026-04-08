export interface TeacherInfo {
  id: string
  username: string
  role: string
}

export interface TeacherAssignment {
  id: string
  teacher: TeacherInfo
  title: string
  description: string
  document: string | null
  deadline: string
  status: 'open' | 'closed'
  maxScore: number
  evaluationCriteria: string
  allowLateSubmission: boolean
  testCases?: Array<{
    id?: string
    input: string
    expectedOutput: string
    isSample: boolean
    weight: number
    orderIndex: number
  }>
  created_at: string
  updated_at: string
}

export interface AssignmentTestCase {
  id?: string
  input: string
  expectedOutput?: string
  isSample: boolean
  weight: number
  orderIndex: number
  created_at?: string
  updated_at?: string
}

export interface AssignmentDocument {
  id?: string
  assignmentId?: string
  assignmentTitle?: string
  uploadedBy: TeacherInfo | string
  fileName: string
  fileUrl: string
  mimeType?: string
  fileSize?: number
  createdAt?: string
  created_at?: string
}

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export interface CreateAssignmentPayload {
  title: string
  description: string
  deadline: string
  status: 'open' | 'closed'
  maxScore: number
  evaluationCriteria: string
  allowLateSubmission: boolean
  testCases: AssignmentTestCase[]
  document?: File | null
}

export interface UpdateAssignmentPayload {
  title: string
  description: string
  deadline: string
  status: 'open' | 'closed'
  maxScore: number
  evaluationCriteria: string
  allowLateSubmission: boolean
}

function extractMessage(body: unknown, fallback: string) {
  if (typeof body === 'object' && body !== null && 'message' in body && typeof (body as { message?: unknown }).message === 'string') {
    return (body as { message: string }).message
  }
  return fallback
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function requestJson<T>(url: string, init: RequestInit, fallback: string): Promise<{ message: string; data: T }> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new Error('Cannot reach assignments API. Please check backend status and CORS settings.')
  }

  const body = await readBody(response)
  if (!response.ok) {
    throw new Error(extractMessage(body, fallback))
  }

  const parsed = body as ApiEnvelope<T>
  return {
    message: parsed.message,
    data: parsed.data,
  }
}

export async function createAssignment(accessToken: string, payload: CreateAssignmentPayload) {
  const formData = new FormData()
  formData.append('title', payload.title)
  formData.append('description', payload.description)
  formData.append('deadline', payload.deadline)
  formData.append('status', payload.status)
  formData.append('maxScore', String(payload.maxScore))
  formData.append('testCases', JSON.stringify(payload.testCases))
  formData.append('evaluationCriteria', payload.evaluationCriteria)
  formData.append('allowLateSubmission', String(payload.allowLateSubmission))
  if (payload.document) {
    formData.append('document', payload.document)
  }

  return requestJson<TeacherAssignment>(
    'http://localhost:3000/assignments',
    {
      method: 'POST',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    },
    'Failed to create assignment',
  )
}

export async function getTeacherAssignments(accessToken: string) {
  return requestJson<TeacherAssignment[]>(
    'http://localhost:3000/assignments',
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load assignments',
  )
}

export async function getAssignmentDetails(accessToken: string, assignmentId: string) {
  return requestJson<TeacherAssignment>(
    `http://localhost:3000/assignments/${assignmentId}`,
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load assignment details',
  )
}

export async function updateAssignment(accessToken: string, assignmentId: string, payload: UpdateAssignmentPayload) {
  return requestJson<TeacherAssignment>(
    `http://localhost:3000/assignments/${assignmentId}`,
    {
      method: 'PATCH',
      headers: {
        accept: '*/*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
    'Failed to update assignment',
  )
}

export async function getAllAssignmentDocuments(accessToken: string) {
  return requestJson<AssignmentDocument[]>(
    'http://localhost:3000/assignments/documents',
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load documents',
  )
}

export async function addAssignmentDocument(accessToken: string, assignmentId: string, document: File) {
  const formData = new FormData()
  formData.append('document', document)

  return requestJson<AssignmentDocument>(
    `http://localhost:3000/assignments/${assignmentId}/documents`,
    {
      method: 'POST',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    },
    'Failed to upload document',
  )
}

export async function getAssignmentDocuments(accessToken: string, assignmentId: string) {
  return requestJson<AssignmentDocument[]>(
    `http://localhost:3000/assignments/${assignmentId}/documents`,
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load assignment documents',
  )
}

export async function getAssignmentTestCases(accessToken: string, assignmentId: string) {
  return requestJson<AssignmentTestCase[]>(
    `http://localhost:3000/assignments/${assignmentId}/test-cases`,
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load assignment test cases',
  )
}
