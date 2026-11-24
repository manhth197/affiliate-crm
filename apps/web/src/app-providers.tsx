import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AuthProvider } from '@/auth/auth-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { defaultConnectRealtime, RealtimeContext } from '@/realtime/realtime-context'
import type { ConnectRealtime } from '@/realtime/types'

/** Providers shared by the real app and by tests. */
export function AppProviders({
  queryClient,
  connectRealtime = defaultConnectRealtime,
  children,
}: {
  queryClient: QueryClient
  /** How to open the realtime connection (tests pass the in-memory mock). */
  connectRealtime?: ConnectRealtime
  children: ReactNode
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeContext value={connectRealtime}>
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </RealtimeContext>
    </QueryClientProvider>
  )
}
