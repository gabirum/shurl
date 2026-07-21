import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { OidcInitializationGate } from './oidc'

import { routeTree } from './routeTree.gen'

const queryClient = new QueryClient()

const router = createRouter({
  basepath: import.meta.env.BASE_URL,
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OidcInitializationGate>
        <RouterProvider router={router} />
      </OidcInitializationGate>
    </QueryClientProvider>
  )
}
