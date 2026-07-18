import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { OverviewPage } from '@/pages/OverviewPage'
import { AutomationPage } from '@/pages/AutomationPage'
import { IdeaIntelligencePage } from '@/pages/IdeaIntelligencePage'
import { ContentStudioPage } from '@/pages/ContentStudioPage'
import { QualityCenterPage } from '@/pages/QualityCenterPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ClientsPage } from '@/pages/ClientsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      { index: true,                element: <OverviewPage /> },
      { path: 'automation',         element: <AutomationPage /> },
      { path: 'ideas',              element: <IdeaIntelligencePage /> },
      { path: 'content',            element: <ContentStudioPage /> },
      { path: 'quality',            element: <QualityCenterPage /> },
      { path: 'history',            element: <HistoryPage /> },
      { path: 'clients',            element: <ClientsPage /> },
      { path: 'settings',           element: <SettingsPage /> },
      { path: '*',                  element: <NotFoundPage /> },
    ],
  },
  // legacy paths → redirect into /app
  { path: '/automation', element: <Navigate to="/app/automation" replace /> },
  { path: '/ideas',      element: <Navigate to="/app/ideas"      replace /> },
  { path: '/content',    element: <Navigate to="/app/content"    replace /> },
  { path: '/quality',    element: <Navigate to="/app/quality"    replace /> },
  { path: '/history',    element: <Navigate to="/app/history"    replace /> },
  { path: '/clients',    element: <Navigate to="/app/clients"    replace /> },
  { path: '/settings',   element: <Navigate to="/app/settings"   replace /> },
  { path: '*',           element: <NotFoundPage /> },
])
