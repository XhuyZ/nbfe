interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export interface StatisticsBucket {
  label: string
  value: number
}

export interface StatisticsOverview {
  totalCourses: number
  totalAssignments: number
  totalSubmissions: number
  suspiciousRate: number
  plagiarismDistribution: StatisticsBucket[]
  submissionCompletion: {
    submitted: number
    expectedAssignments: number
    completionRate: number
  }
}

export interface StatisticsVisualization {
  barChart: Array<{
    courseId: string
    courseName: string
    submissionCount: number
  }>
  pieChart: StatisticsBucket[]
  trendChart: Array<{
    date: string
    submissionCount: number
  }>
}

export interface SubmissionTrends {
  course: {
    id: string
    name: string
  }
  range: {
    days: number
    from: string
    to: string
    granularity: string
  }
  summary: {
    totalSubmissions: number
    averagePerDay: number
    peakDate: string
    peakSubmissionCount: number
  }
  points: Array<{
    date: string
    submissionCount: number
  }>
}

export interface ExportedStatisticsReport {
  id: string
  fileUrl: string
  fileName: string
  metadata?: unknown
}

export interface ExportStatisticsPdfResult {
  downloadUrl: string
  filename: string | null
  objectUrl?: string
  report?: ExportedStatisticsReport
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
    throw new Error('Cannot reach statistics API. Please check backend status and CORS settings.')
  }

  const body = await readBody(response)
  if (!response.ok) {
    throw new Error(extractMessage(body, fallback))
  }

  const parsed = body as ApiEnvelope<T>
  return { message: parsed.message, data: parsed.data }
}

export async function getStatisticsOverview(accessToken: string, courseId: string) {
  const url = new URL('http://localhost:3000/statistics-reporting/overview')
  url.searchParams.set('courseId', courseId)

  return requestJson<StatisticsOverview>(
    url.toString(),
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load overview statistics',
  )
}

export async function getStatisticsVisualization(accessToken: string, courseId: string) {
  const url = new URL('http://localhost:3000/statistics-reporting/visualization')
  url.searchParams.set('courseId', courseId)

  return requestJson<StatisticsVisualization>(
    url.toString(),
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load visualization data',
  )
}

export async function getSubmissionTrends(accessToken: string, courseId: string, days = 30) {
  const url = new URL('http://localhost:3000/statistics-reporting/submission-trends')
  url.searchParams.set('courseId', courseId)
  url.searchParams.set('days', String(days))

  return requestJson<SubmissionTrends>(
    url.toString(),
    {
      method: 'GET',
      headers: {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'Failed to load submission trends',
  )
}

function getFilenameFromDisposition(disposition: string | null) {
  if (!disposition) return null
  const match = disposition.match(/filename="?([^"]+)"?/)
  return match?.[1] ?? null
}

export async function exportStatisticsPdf(accessToken: string, courseId: string) {
  let response: Response
  try {
    response = await fetch('http://localhost:3000/statistics-reporting/export-pdf', {
      method: 'POST',
      headers: {
        accept: '*/*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ courseId }),
    })
  } catch {
    throw new Error('Cannot reach statistics API. Please check backend status and CORS settings.')
  }

  if (!response.ok) {
    const body = await readBody(response)
    throw new Error(extractMessage(body, 'Failed to export PDF report'))
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = (await readBody(response)) as ApiEnvelope<ExportedStatisticsReport> | null
    const report = body?.data

    if (!report?.fileUrl) {
      throw new Error('PDF report was generated but no file URL was returned.')
    }

    return {
      downloadUrl: report.fileUrl,
      filename: report.fileName ?? null,
      report,
    } satisfies ExportStatisticsPdfResult
  }

  const blob = await response.blob()
  const filename = getFilenameFromDisposition(response.headers.get('content-disposition'))
  const objectUrl = URL.createObjectURL(blob)

  return {
    downloadUrl: objectUrl,
    filename,
    objectUrl,
  } satisfies ExportStatisticsPdfResult
}
