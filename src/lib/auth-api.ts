export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  success: boolean
  message: string
  data: {
    access_token: string
    token_type: string
    user: {
      id: string
      username: string
      role: string
    }
  }
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface ForgotPasswordRequest {
  username: string
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
}

export interface AuthActionResponse {
  success: boolean
  message: string
  data?: any
}

const BASE_AUTH_URL = 'http://localhost:3000/auth'

async function handleResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  let responseBody: any = null
  try {
    responseBody = await response.json()
  } catch {
    responseBody = null
  }

  if (!response.ok) {
    const message =
      typeof responseBody === 'object' &&
        responseBody !== null &&
        'message' in responseBody &&
        typeof responseBody.message === 'string'
        ? responseBody.message
        : fallbackMessage
    throw new Error(message)
  }

  return responseBody as T
}

export async function loginApi(payload: LoginRequest): Promise<LoginResponse> {
  try {
    const response = await fetch(`${BASE_AUTH_URL}/login`, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    return handleResponse<LoginResponse>(response, 'Login failed')
  } catch (error) {
    if (error instanceof Error && !error.message.includes('failed')) {
      throw error
    }
    throw new Error('Cannot reach auth server at http://localhost:3000. Please check backend status and CORS settings.')
  }
}

export async function changePasswordApi(accessToken: string, payload: ChangePasswordRequest): Promise<AuthActionResponse> {
  const response = await fetch(`${BASE_AUTH_URL}/change-password`, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })
  return handleResponse<AuthActionResponse>(response, 'Failed to change password')
}

export async function forgotPasswordApi(payload: ForgotPasswordRequest): Promise<AuthActionResponse> {
  const response = await fetch(`${BASE_AUTH_URL}/forgot-password`, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return handleResponse<AuthActionResponse>(response, 'Failed to process forgot password')
}

export async function resetPasswordApi(payload: ResetPasswordRequest): Promise<AuthActionResponse> {
  const response = await fetch(`${BASE_AUTH_URL}/reset-password`, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return handleResponse<AuthActionResponse>(response, 'Failed to reset password')
}
