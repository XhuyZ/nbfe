import { useState, type FormEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, GraduationCap, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const { login } = useAuth()
  const { redirect } = Route.useSearch()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loginMutation = useMutation({
    mutationFn: async () => login(username, password),
    onSuccess: (result) => {
      toast.success(result.message)
      if (redirect && redirect.startsWith('/')) {
        window.location.assign(redirect)
        return
      }

      window.location.assign(`/${result.user.role}`)
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : 'Login failed'
      setError(message)
      toast.error(message)
    },
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    loginMutation.mutate()
  }

  const isSubmitting = loginMutation.isPending

  const usernameError = username.trim().length === 0
  const passwordError = password.trim().length === 0

  const isDisabled = isSubmitting || usernameError || passwordError

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_42%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] px-4 py-10 sm:px-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="grid min-h-[680px] lg:grid-cols-[1.02fr_0.98fr]">
          <section className="flex items-center justify-center bg-white px-6 py-10 sm:px-10 lg:px-16">
            <div className="w-full max-w-md">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-blue-600/20">
                <GraduationCap className="h-8 w-8" />
              </div>

              <div className="mt-6 text-center">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Welcome Back</h1>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Coursework Review System for Code Similarity Detection and Evidence Chain Generation
                </p>
              </div>

              <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
                {error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Sign-in failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs font-medium text-slate-600">
                    Account
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Enter your account"
                    autoComplete="username"
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 px-4 shadow-sm shadow-slate-100 transition focus-visible:border-blue-300 focus-visible:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-medium text-slate-600">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 px-4 shadow-sm shadow-slate-100 transition focus-visible:border-blue-300 focus-visible:ring-blue-500/20"
                  />
                </div>

                <div className="flex justify-end text-sm">
                  <button
                    type="button"
                    onClick={() => toast.info('Please contact IT Support to reset your password.')}
                    className="font-medium text-primary transition hover:text-primary/80"
                  >
                    Forgot Password?
                  </button>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-[#2857d9] text-base font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-[#214dca]"
                  disabled={isDisabled}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-400">
                Need help? Contact <span className="font-semibold text-primary">IT Support</span>
              </p>
            </div>
          </section>

          <aside
            className="relative hidden overflow-hidden bg-slate-800 bg-cover bg-center lg:flex"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(15, 23, 42, 0.16) 0%, rgba(30, 64, 175, 0.48) 55%, rgba(30, 64, 175, 0.82) 100%), url('https://img.rednet.cn/2023/11-06/9069867c-0487-434a-955c-bd17dcbe6688.jpg')",
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.28),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.28),_transparent_40%)]" />

            <div className="relative flex h-full w-full flex-col justify-between px-10 py-12 text-white">
              <div className="flex flex-1 items-center justify-center">
                <div className="h-24 w-24 rounded-[28px] border border-white/20 bg-white/10 backdrop-blur-sm" />
              </div>

              <div className="max-w-sm">
                <h2 className="text-4xl font-semibold leading-tight">Enhancing Academic Integrity</h2>
                <p className="mt-5 text-base leading-8 text-blue-50/90">
                  Streamline coursework review with intelligent code similarity detection and automated evidence
                  chain generation for students, instructors, and administrators.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
