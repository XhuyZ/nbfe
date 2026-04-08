export interface SubmissionItem {
  id: string
  student: {
    id: string
    username: string
    role: string
  }
  assignment: {
    id: string
    title: string
    description: string
    document: string | null
    deadline: string
    maxScore?: number
    evaluationCriteria?: string
    allowLateSubmission?: boolean
    status: string
    created_at: string
    updated_at: string
  }
  code: string | null
  file: string | null
  language: string
  score: number | null
  status: string
  versionCount?: number
  lastSubmittedAt?: string
  highestSimilarity?: number | null
  plagiarismFlag?: boolean
  passRate?: number | null
  judgeStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  plagiarismStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  latestTestResults?: Array<{
    id: string
    passed: boolean
    actualOutput: string | null
    errorMessage: string | null
    executionTimeMs: number | null
    testCase: {
      id: string
      input: string
      expectedOutput?: string
      isSample: boolean
      weight: number
      orderIndex: number
    }
  }>
  created_at: string
  updated_at: string
}

interface SubmissionsResponse {
  success: boolean
  message: string
  data: SubmissionItem[]
}

const SUBMISSIONS_URL = 'http://localhost:3000/submissions'

export async function getStudentSubmissions(accessToken: string): Promise<{ message: string; data: SubmissionItem[] }> {
  let response: Response

  try {
    response = await fetch(SUBMISSIONS_URL, {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new Error('Cannot reach submissions API. Please ensure backend and CORS are configured correctly.')
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
        : 'Failed to load submissions'
    throw new Error(message)
  }

  const parsed = body as SubmissionsResponse
  return {
    message: parsed.message,
    data: parsed.data ?? [],
  }
}
