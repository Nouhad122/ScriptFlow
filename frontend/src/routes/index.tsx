import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
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
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true,          element: <OverviewPage /> },
      { path: 'automation',   element: <AutomationPage /> },
      { path: 'ideas',        element: <IdeaIntelligencePage /> },
      { path: 'content',      element: <ContentStudioPage /> },
      { path: 'quality',      element: <QualityCenterPage /> },
      { path: 'history',      element: <HistoryPage /> },
      { path: 'clients',      element: <ClientsPage /> },
      { path: 'settings',     element: <SettingsPage /> },
      { path: '*',            element: <NotFoundPage /> },
    ],
  },
])
