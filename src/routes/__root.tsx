import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'

import type { RouterAppContext } from '@/router'

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
})

function RootComponent() {
  return <Outlet />
}
