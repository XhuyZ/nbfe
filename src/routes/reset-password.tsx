import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { GraduationCap, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'react-toastify'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPasswordApi } from '@/lib/auth-api'

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const search = Route.useSearch()
  const [manualToken, setManualToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const token = search.token || manualToken

  const resetMutation = useMutation({
    mutationFn: async () => resetPasswordApi({ token, newPassword }),
    onSuccess: (result) => {
      toast.success(result.message)
      setIsSuccess(true)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to reset password')
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error('Token is required')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    resetMutation.mutate()
  }

  const isDisabled = resetMutation.isPending || !newPassword || !confirmPassword || !token

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_42%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] px-4 py-10 sm:px-6">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/60 bg-white p-8 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-blue-600/20">
          <GraduationCap className="h-8 w-8" />
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Reset Password</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Please enter your reset token and new password below.
          </p>
        </div>

        {isSuccess ? (
          <div className="mt-8 space-y-6 text-center">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            </div>
            <p className="text-slate-600">Your password has been reset successfully.</p>
            <Button className="w-full" asChild>
              <Link to="/login">Back to Login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {!search.token && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Missing Token</AlertTitle>
                  <AlertDescription>
                    Invalid or missing reset token. Please enter it manually if you have one.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="token">Reset Token</Label>
                  <Input
                    id="token"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Enter your reset token"
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="h-12 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-[#2857d9] text-base font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-[#214dca]"
              disabled={isDisabled}
            >
              {resetMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>

            <p className="text-center text-sm">
              <Link to="/login" className="text-primary hover:underline">
                Back to Login
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
