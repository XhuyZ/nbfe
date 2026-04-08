import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getDashboardByRole } from '@/lib/mock-api'
import type { UserRole } from '@/modules/auth/auth-context'

export function RoleDashboard({ role }: { role: UserRole }) {
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', role],
    queryFn: () => getDashboardByRole(role),
  })

  if (dashboardQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading dashboard...</p>
  }

  if (dashboardQuery.isError) {
    return <p className="text-sm text-destructive">Unable to load dashboard data.</p>
  }

  const data = dashboardQuery.data
  if (!data) {
    return null
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{data.heading}</h1>
        <Badge variant="outline">{role}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Data is loaded with TanStack Query (mock API).</p>

      <div className="grid gap-4 md:grid-cols-3">
        {data.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-2xl">{metric.value}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">Realtime updates ready (demo)</CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
