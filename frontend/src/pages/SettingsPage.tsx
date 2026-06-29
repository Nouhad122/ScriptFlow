import { Settings } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { SectionHeader } from '@/components/SectionHeader'
import { EmptyState } from '@/components/EmptyState'

export function SettingsPage() {
  return (
    <PageContainer>
      <div className="space-y-8">
        <SectionHeader
          title="Settings"
          description="Configure clients, API keys, and system preferences."
        />
        <EmptyState
          icon={Settings}
          title="Settings coming soon"
          description="Manage client contexts, reference packs, and application settings from here."
        />
      </div>
    </PageContainer>
  )
}
