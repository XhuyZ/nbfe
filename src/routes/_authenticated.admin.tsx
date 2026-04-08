import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'react-toastify'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createUser, getAllUsers, updateUserStatus, type AdminUser } from '@/lib/admin-users-api'
import { useAuth, type UserRole } from '@/modules/auth/auth-context'

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: ({ context }) => {
    const role = context.auth.user?.role
    if (role && role !== 'admin') {
      throw redirect({ to: `/${role}` as '/student' | '/teacher' })
    }
  },
  component: AdminPage,
})

function AdminPage() {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const usersQuery = useQuery<{ message: string; data: AdminUser[] }, Error>({
    queryKey: ['admin-users', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => getAllUsers(accessToken!),
  })

  useEffect(() => {
    if (usersQuery.isSuccess) {
      toast.success(usersQuery.data.message)
    }
  }, [usersQuery.isSuccess, usersQuery.data?.message])

  useEffect(() => {
    if (usersQuery.isError) {
      toast.error(usersQuery.error.message)
    }
  }, [usersQuery.isError, usersQuery.error?.message])

  const createUserMutation = useMutation({
    mutationFn: async () => createUser(accessToken!, { username, password, role }),
    onSuccess: async (result) => {
      setUsername('')
      setPassword('')
      setRole('student')
      setOpenCreateDialog(false)
      setActionError(null)
      toast.success(result.message)
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to create user'
      setActionError(message)
      toast.error(message)
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async (params: { userId: string; status: boolean }) => updateUserStatus(accessToken!, params.userId, params.status),
    onSuccess: async (result) => {
      setActionError(null)
      toast.success(result.message)
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update user status'
      setActionError(message)
      toast.error(message)
    },
  })

  const onCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionError(null)
    createUserMutation.mutate()
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Admin User Management</h1>
        <p className="text-sm text-muted-foreground">Create users and update account status.</p>
      </div>

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <div>
        <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>Fill username, password, and role to create an account.</DialogDescription>
            </DialogHeader>
            <form onSubmit={onCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-username">Username</Label>
                <Input
                  id="new-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="new-user"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="******"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Role</Label>
                <select
                  id="new-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as UserRole)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="student">student</option>
                  <option value="teacher">teacher</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createUserMutation.isPending || !accessToken}>
                  {createUserMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create user'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>View all users and toggle active status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {usersQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading users...</p> : null}
          {usersQuery.isError ? <p className="text-sm text-destructive">{usersQuery.error.message}</p> : null}

          {usersQuery.isSuccess && usersQuery.data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : null}

          {usersQuery.isSuccess
            ? usersQuery.data.data.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{item.username}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">{item.role}</Badge>
                      <Badge variant={item.status ? 'default' : 'outline'}>{item.status ? 'active' : 'inactive'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Created: {new Date(item.created_at).toLocaleString()}</p>
                  </div>

                  <Button
                    variant="outline"
                    disabled={updateStatusMutation.isPending || !accessToken}
                    onClick={() => updateStatusMutation.mutate({ userId: item.id, status: !item.status })}
                  >
                    {updateStatusMutation.isPending ? 'Updating...' : item.status ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              ))
            : null}
        </CardContent>
      </Card>
    </section>
  )
}
