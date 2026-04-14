interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export interface CourseChapter {
  id: string
  title: string
  orderIndex: number
  assignmentId: string | null
  assignment?: {
    id: string
  } | null
  created_at?: string
  updated_at?: string
}

export interface CourseItem {
  id: string
  name: string
  description: string
  isPublished: boolean
  teacher: {
    id: string
    username: string
  }
  chapters: CourseChapter[]
  created_at: string
  updated_at: string
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
    throw new Error('Cannot reach courses API. Please check backend status and CORS settings.')
  }

  const body = await readBody(response)
  if (!response.ok) {
    throw new Error(extractMessage(body, fallback))
  }

  const parsed = body as ApiEnvelope<T>
  return { message: parsed.message, data: parsed.data }
}

export async function createCourse(accessToken: string, payload: { name: string; description: string }) {
  return requestJson<CourseItem>(
    'http://localhost:3000/courses',
    {
      method: 'POST',
      headers: {
        accept: '*/*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
    'Failed to create course',
  )
}

export async function getAllCourses(accessToken: string, teacherId?: string) {
  const url = new URL('http://localhost:3000/courses')
  if (teacherId) {
    url.searchParams.set('teacherId', teacherId)
  }

  return requestJson<CourseItem[]>(
    url.toString(),
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load courses',
  )
}

export async function getTeachingCourses(accessToken: string) {
  return requestJson<CourseItem[]>(
    'http://localhost:3000/courses/my/teaching',
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load teaching courses',
  )
}

export async function getCourseById(accessToken: string, courseId: string) {
  return requestJson<CourseItem>(
    `http://localhost:3000/courses/${courseId}`,
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load course detail',
  )
}

export async function createCourseChapter(accessToken: string, courseId: string, payload: { title: string }) {
  return requestJson<CourseChapter>(
    `http://localhost:3000/courses/${courseId}/chapters`,
    {
      method: 'POST',
      headers: {
        accept: '*/*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
    'Failed to create chapter',
  )
}

export async function getCourseChapters(accessToken: string, courseId: string) {
  return requestJson<CourseChapter[]>(
    `http://localhost:3000/courses/${courseId}/chapters`,
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load chapters',
  )
}

export async function enrollCourse(accessToken: string, courseId: string) {
  return requestJson<{ id: string }>(
    `http://localhost:3000/courses/${courseId}/enroll`,
    {
      method: 'POST',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to enroll course',
  )
}

export async function getEnrolledCourses(accessToken: string) {
  return requestJson<CourseItem[]>(
    'http://localhost:3000/courses/my/enrolled',
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load enrolled courses',
  )
}
