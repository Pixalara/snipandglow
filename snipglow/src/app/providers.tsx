'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { useState } from 'react'

// =============================================================================
// React Query devtools — DEVELOPMENT ONLY.
//
// This used to be a plain top-level `import { ReactQueryDevtools }`, which put
// the entire devtools panel into the production bundle on EVERY route. It is a
// large dependency and it was being downloaded and parsed by real salon owners
// who can never open it, which shows up directly in First Contentful Paint.
//
// `process.env.NODE_ENV` is inlined at build time, so in a production build this
// whole branch — and the dynamic import inside it — is eliminated rather than
// merely skipped at runtime.
// =============================================================================
const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(() =>
        import('@tanstack/react-query-devtools').then((m) => ({
          default: m.ReactQueryDevtools,
        })),
      )
    : () => null

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,       // 1 min
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {children}
        <Toaster richColors position="top-right" />
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
