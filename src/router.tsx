import { QueryClient } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'

import { useAuth, type AuthContextValue } from '@/modules/auth/auth-context'
import { routeTree } from '@/routeTree.gen'

export interface RouterAppContext {
  auth: AuthContextValue
  queryClient: QueryClient
}

export const queryClient = new QueryClient()

export const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
    queryClient,
  },
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function AppRouter() {
  const auth = useAuth()

  return <RouterProvider router={router} context={{ auth, queryClient }} />
}
