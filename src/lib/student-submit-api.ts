interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

interface SubmissionData {
  id: string
  status: string
}

interface SubmitWithCodePayload {
  assignmentId: string
  code: string
  language: string
}

interface SubmitWithFilePayload {
  assignmentId: string
  language: string
  file: File
  code?: string
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function extractMessage(body: unknown, fallback: string) {
  if (typeof body === 'object' && body !== null && 'message' in body && typeof (body as { message?: unknown }).message === 'string') {
    return (body as { message: string }).message
  }
  return fallback
}

export async function submitAssignmentWithCode(
  accessToken: string,
  payload: SubmitWithCodePayload,
): Promise<{ message: string; data: SubmissionData }> {
  const formData = new FormData()
  formData.append('assignmentId', payload.assignmentId)
  formData.append('code', payload.code)
  formData.append('language', payload.language)
  formData.append('file', '')

  let response: Response
  try {
    response = await fetch('http://localhost:3000/submissions', {
      method: 'POST',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    })
  } catch {
    throw new Error('Cannot reach submission API. Please check backend status and CORS settings.')
  }

  const body = await readBody(response)
  if (!response.ok) {
    throw new Error(extractMessage(body, 'Failed to submit code'))
  }

  const parsed = body as ApiEnvelope<SubmissionData>
  return { message: parsed.message, data: parsed.data }
}

export async function submitAssignmentWithFile(
  accessToken: string,
  payload: SubmitWithFilePayload,
): Promise<{ message: string; data: SubmissionData }> {
  const formData = new FormData()
  formData.append('assignmentId', payload.assignmentId)
  formData.append('language', payload.language)
  formData.append('code', payload.code ?? '')
  formData.append('file', payload.file)

  let response: Response
  try {
    response = await fetch('http://localhost:3000/submissions', {
      method: 'POST',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    })
  } catch {
    throw new Error('Cannot reach submission API. Please check backend status and CORS settings.')
  }

  const body = await readBody(response)
  if (!response.ok) {
    throw new Error(extractMessage(body, 'Failed to submit file'))
  }

  const parsed = body as ApiEnvelope<SubmissionData>
  return { message: parsed.message, data: parsed.data }
}
