import { History } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { SectionHeader } from '@/components/SectionHeader'
import { EmptyState } from '@/components/EmptyState'

export function HistoryPage() {
  return (
    <PageContainer>
      <div className="space-y-8">
        <SectionHeader
          title="History"
          description="Browse past pipeline runs and their outputs."
        />
        <EmptyState
          icon={History}
          title="Pipeline history coming soon"
          description="View a chronological log of all pipeline runs, ideas generated, and scripts delivered."
        />
      </div>
    </PageContainer>
  )
}
