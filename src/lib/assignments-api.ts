export interface AssignmentItem {
  id: string
  teacher: {
    id: string
    username: string
    role: string
  }
  chapter?: {
    id: string
    title: string
    orderIndex: number
    course?: {
      id: string
      name: string
    }
  }
  title: string
  description: string
  document: string | null
  deadline: string
  status: string
  maxScore?: number
  evaluationCriteria?: string
  allowLateSubmission?: boolean
  created_at: string
  updated_at: string
}

interface AssignmentsResponse {
  success: boolean
  message: string
  data: AssignmentItem[]
}

interface AssignmentDetailResponse {
  success: boolean
  message: string
  data: AssignmentItem
}

const ASSIGNMENTS_URL = 'http://localhost:3000/assignments/all'
const MY_COURSE_ASSIGNMENTS_URL = 'http://localhost:3000/courses/my/assignments'

export async function getAllAssignments(accessToken: string): Promise<{ message: string; data: AssignmentItem[] }> {
  let response: Response

  try {
    response = await fetch(ASSIGNMENTS_URL, {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new Error('Cannot reach assignments API. Please check backend status and CORS settings.')
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body && typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : 'Failed to load assignments'
    throw new Error(message)
  }

  const parsed = body as AssignmentsResponse
  return {
    message: parsed.message,
    data: parsed.data ?? [],
  }
}

export async function getMyCourseAssignments(
  accessToken: string,
  courseId: string,
): Promise<{ message: string; data: AssignmentItem[] }> {
  let response: Response
  const url = new URL(MY_COURSE_ASSIGNMENTS_URL)
  url.searchParams.set('courseId', courseId)

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new Error('Cannot reach assignments API. Please check backend status and CORS settings.')
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body && typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : 'Failed to load enrolled course assignments'
    throw new Error(message)
  }

  const parsed = body as AssignmentsResponse
  return {
    message: parsed.message,
    data: parsed.data ?? [],
  }
}

export async function getAssignmentById(
  accessToken: string,
  assignmentId: string,
): Promise<{ message: string; data: AssignmentItem }> {
  let response: Response

  try {
    response = await fetch(`http://localhost:3000/assignments/${assignmentId}`, {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new Error('Cannot reach assignments API. Please check backend status and CORS settings.')
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body && typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : 'Failed to load assignment details'
    throw new Error(message)
  }

  const parsed = body as AssignmentDetailResponse
  return {
    message: parsed.message,
    data: parsed.data,
  }
}
