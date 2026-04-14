import { Link, useNavigate } from '@tanstack/react-router'
import { BookOpenCheck, FileCode2, FileText, GraduationCap, LogOut, Shield, User, Users } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useAuth, type UserRole } from '@/modules/auth/auth-context'

const menuByRole: Record<
  UserRole,
  Array<{
    to:
      | '/student'
      | '/teacher'
      | '/admin'
      | '/submissions'
      | '/assignments'
      | '/teacher-courses'
      | '/student-courses'
      | '/student-courses/all'
    label: string
    icon: ReactNode
  }>
> = {
  student: [
    { to: '/student', label: 'Student Dashboard', icon: <User className="h-4 w-4" /> },
    { to: '/student-courses/all', label: 'All Courses', icon: <GraduationCap className="h-4 w-4" /> },
    { to: '/student-courses', label: 'My Courses', icon: <GraduationCap className="h-4 w-4" /> },
    { to: '/assignments', label: 'My Assignments', icon: <FileText className="h-4 w-4" /> },
    { to: '/submissions', label: 'Submissions', icon: <FileCode2 className="h-4 w-4" /> },
  ],
  teacher: [
    { to: '/teacher-courses', label: 'Course Management', icon: <BookOpenCheck className="h-4 w-4" /> },
  ],
  admin: [{ to: '/admin', label: 'Admin Dashboard', icon: <Shield className="h-4 w-4" /> }],
}

export function AppSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    return null
  }

  const items = menuByRole[user.role]

  const onLogout = () => {
    logout()
    navigate({ to: '/' })
  }

  return (
    <aside className="w-72 border-r bg-background p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Code Grading System</p>
        <p className="text-xs text-muted-foreground">Welcome, {user.username}</p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Badge variant="secondary">
          <Users className="mr-1 h-3 w-3" />
          {user.role}
        </Badge>
      </div>

      <Separator className="my-4" />

      <nav className="space-y-2">
        <Link to="/" className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground">
          Home
        </Link>
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              '[&.active]:bg-accent [&.active]:text-accent-foreground',
            )}
            activeProps={{ className: 'active' }}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <Button variant="outline" className="mt-6 w-full justify-start gap-2" onClick={onLogout}>
        <LogOut className="h-4 w-4" />
        Logout
      </Button>
    </aside>
  )
}
