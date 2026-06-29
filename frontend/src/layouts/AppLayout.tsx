import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function AppLayout() {
  return (
    <div className="flex h-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <Toaster theme="dark" richColors position="bottom-right" />
    </div>
  )
}
