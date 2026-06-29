import { FileText } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { SectionHeader } from '@/components/SectionHeader'
import { EmptyState } from '@/components/EmptyState'

export function ContentStudioPage() {
  return (
    <PageContainer>
      <div className="space-y-8">
        <SectionHeader
          title="Content Studio"
          description="Generate and manage scripts for approved ideas."
        />
        <EmptyState
          icon={FileText}
          title="Script generation coming soon"
          description="Generate scripts from approved ideas, preview hooks and body copy, and submit for quality review."
        />
      </div>
    </PageContainer>
  )
}
