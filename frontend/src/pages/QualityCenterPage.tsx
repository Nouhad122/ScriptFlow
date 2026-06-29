import { ShieldCheck } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { SectionHeader } from '@/components/SectionHeader'
import { EmptyState } from '@/components/EmptyState'

export function QualityCenterPage() {
  return (
    <PageContainer>
      <div className="space-y-8">
        <SectionHeader
          title="Quality Center"
          description="Review quality scores and manage held scripts."
        />
        <EmptyState
          icon={ShieldCheck}
          title="Quality reviews coming soon"
          description="Inspect 10-criteria quality reports, view per-check scores, and manage held scripts."
        />
      </div>
    </PageContainer>
  )
}
