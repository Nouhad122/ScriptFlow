import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion, domAnimation } from 'motion/react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
})

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* reducedMotion="user" makes every m.* component respect prefers-reduced-motion */}
      <LazyMotion features={domAnimation} reducedMotion="user">
        {children}
      </LazyMotion>
    </QueryClientProvider>
  )
}
