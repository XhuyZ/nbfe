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

const LOGIN_URL = 'http://localhost:3000/auth/login'

export async function loginApi(payload: LoginRequest): Promise<LoginResponse> {
  let response: Response
  try {
    response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error(
      'Cannot reach auth server at http://localhost:3000. Please check backend status and CORS settings.',
    )
  }

  let responseBody: unknown = null
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
      typeof (responseBody as { message?: unknown }).message === 'string'
        ? (responseBody as { message: string }).message
        : 'Login failed'
    throw new Error(message)
  }

  return responseBody as LoginResponse
}
