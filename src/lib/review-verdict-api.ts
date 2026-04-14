interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export type VerdictStatus = 'confirmed_copy' | 'need_more_review' | 'clean'

export interface HighRiskSubmission {
  submissionId: string
  student: string
  assignment: string
  course: string
  highestSimilarity: number
  status: VerdictStatus
  reviewNote: string | null
}

export interface ReviewVerdictDetail {
  submissionId: string
  verdict: VerdictStatus
  note: string | null
  reviewer: string | null
  reviewedAt: string | null
  matches: Array<{
    plagiarismId: string
    similarity: number
    highRisk: boolean
    evidence: {
      commonLines: string[]
      commonTokens: string[]
    }
  }>
}

export interface PlagiarismStats {
  submissionId: string
  student: {
    id: string
    username: string
  }
  highestSimilarity: number
  highRiskCount: number
  matches: Array<{
    plagiarismId: string
    similarity: number
    highRisk: boolean
    submitVersionAId: string
    submitVersionBId: string
    evidence: {
      commonLines: string[]
      commonTokens: string[]
    }
  }>
}

export interface EvidenceChain {
  submissionId: string
  generatedAt: string
  chain: Array<{
    plagiarismId: string
    similarity: number
    highRisk: boolean
    evidence: {
      commonLines: string[]
      commonTokens: string[]
    }
    pair: {
      submissionAId: string
      studentA: string
      submittedAtA: string
      submissionBId: string
      studentB: string
      submittedAtB: string
    }
  }>
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
    throw new Error('Cannot reach review API. Please check backend status and CORS settings.')
  }

  const body = await readBody(response)
  if (!response.ok) {
    throw new Error(extractMessage(body, fallback))
  }

  const parsed = body as ApiEnvelope<T>
  return { message: parsed.message, data: parsed.data }
}

export async function getHighRiskSubmissions(accessToken: string, courseId: string) {
  const url = new URL('http://localhost:3000/review-verdict/high-risk')
  url.searchParams.set('courseId', courseId)

  return requestJson<HighRiskSubmission[]>(
    url.toString(),
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load high-risk submissions',
  )
}

export async function getReviewVerdictDetail(accessToken: string, submissionId: string) {
  return requestJson<ReviewVerdictDetail>(
    `http://localhost:3000/review-verdict/${submissionId}`,
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load review verdict detail',
  )
}

export async function getSubmissionPlagiarismStats(accessToken: string, submissionId: string) {
  return requestJson<PlagiarismStats>(
    `http://localhost:3000/submissions/${submissionId}/plagiarism/stats`,
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load plagiarism stats',
  )
}

export async function getEvidenceChain(accessToken: string, submissionId: string) {
  return requestJson<EvidenceChain>(
    `http://localhost:3000/evidence-chain/${submissionId}`,
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load evidence chain',
  )
}

export async function updateReviewVerdict(
  accessToken: string,
  submissionId: string,
  payload: { verdict: VerdictStatus; note: string },
) {
  return requestJson<{
    id: string
    verdict: VerdictStatus
    note: string
    reviewedAt: string
  }>(
    `http://localhost:3000/review-verdict/${submissionId}/verdict`,
    {
      method: 'PATCH',
      headers: {
        accept: '*/*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
    'Failed to update verdict',
  )
}
