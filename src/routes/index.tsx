import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, ShieldCheck, UsersRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { user } = useAuth()

  return (
    <main className="bg-background">
      <section className="container mx-auto max-w-6xl px-4 pb-8 pt-12 md:pt-16">
        <div className="space-y-5">
          <Badge variant="secondary">Code Grading Platform</Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            A modern code grading system for students, teachers, and admins
          </h1>
          <p className="max-w-3xl text-base text-muted-foreground">
            Manage submissions, grading workflows, and progress tracking in a clean UI designed for real backend integration.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/login" search={{ redirect: undefined }}>
                {user ? 'Switch account' : 'Get started'}
              </Link>
            </Button>
            {user ? (
              <Button variant="outline" asChild>
                <Link to={`/${user.role}` as '/student' | '/teacher' | '/admin'}>
                  Open dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link to="/login" search={{ redirect: undefined }}>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 pb-12">
        <Separator className="mb-8" />
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UsersRound className="h-5 w-5" />
                Student
              </CardTitle>
              <CardDescription>Submit coding assignments and review grading outcomes per task.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5" />
                Teacher
              </CardTitle>
              <CardDescription>Grade submissions, manage assignments, and monitor class quality.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5" />
                Admin
              </CardTitle>
              <CardDescription>Oversee users, system configuration, and operational analytics.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
    </main>
  )
}
