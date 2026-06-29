import { Zap } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { SectionHeader } from '@/components/SectionHeader'
import { EmptyState } from '@/components/EmptyState'

export function AutomationPage() {
  return (
    <PageContainer>
      <div className="space-y-8">
        <SectionHeader
          title="Automation"
          description="Run the full content pipeline from a single trigger."
        />
        <EmptyState
          icon={Zap}
          title="Pipeline runner coming soon"
          description="Trigger full pipeline runs, monitor progress, and manage client contexts from here."
        />
      </div>
    </PageContainer>
  )
}
