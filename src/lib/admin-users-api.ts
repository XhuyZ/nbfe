import type { UserRole } from '@/modules/auth/auth-context'

export interface AdminUser {
  id: string
  username: string
  role: UserRole
  status: boolean
  created_at: string
  updated_at: string
}

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

interface CreateUserPayload {
  username: string
  password: string
  role: UserRole
}

function parseApiError(body: unknown, fallback: string): Error {
  const message =
    typeof body === 'object' && body !== null && 'message' in body && typeof (body as { message?: unknown }).message === 'string'
      ? (body as { message: string }).message
      : fallback
  return new Error(message)
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function getAllUsers(accessToken: string): Promise<{ message: string; data: AdminUser[] }> {
  let response: Response

  try {
    response = await fetch('http://localhost:3000/users', {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new Error('Cannot reach users API. Please check backend status and CORS settings.')
  }

  const body = await readBody(response)
  if (!response.ok) {
    throw parseApiError(body, 'Failed to load users')
  }

  const parsed = body as ApiEnvelope<AdminUser[]>
  return { message: parsed.message, data: parsed.data ?? [] }
}

export async function createUser(
  accessToken: string,
  payload: CreateUserPayload,
): Promise<{ message: string; data: AdminUser }> {
  let response: Response

  try {
    response = await fetch('http://localhost:3000/users', {
      method: 'POST',
      headers: {
        accept: '*/*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        ...payload,
        status: true,
      }),
    })
  } catch {
    throw new Error('Cannot reach users API. Please check backend status and CORS settings.')
  }

  const body = await readBody(response)
  if (!response.ok) {
    throw parseApiError(body, 'Failed to create user')
  }

  const parsed = body as ApiEnvelope<AdminUser>
  return { message: parsed.message, data: parsed.data }
}

export async function updateUserStatus(
  accessToken: string,
  userId: string,
  status: boolean,
): Promise<{ message: string; data: AdminUser }> {
  let response: Response

  try {
    response = await fetch(`http://localhost:3000/users/${userId}/status`, {
      method: 'PATCH',
      headers: {
        accept: '*/*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status }),
    })
  } catch {
    throw new Error('Cannot reach users API. Please check backend status and CORS settings.')
  }

  const body = await readBody(response)
  if (!response.ok) {
    throw parseApiError(body, 'Failed to update user status')
  }

  const parsed = body as ApiEnvelope<AdminUser>
  return { message: parsed.message, data: parsed.data }
}
