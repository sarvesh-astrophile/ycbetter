import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { SiteHeader } from '@/components/site-header'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <div className="flex min-h-screen flex-col bg-[#f5f5e5] text-foreground">
        <SiteHeader />
        <main className="container mx-auto grow p-4">
          <Outlet />
        </main>
        <footer className="p-4 text-center">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} YC Better. All rights reserved.
          </p>
        </footer>
      </div>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools />
    </>
  )
}
