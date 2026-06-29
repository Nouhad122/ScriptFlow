import { Lightbulb } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { SectionHeader } from '@/components/SectionHeader'
import { EmptyState } from '@/components/EmptyState'

export function IdeaIntelligencePage() {
  return (
    <PageContainer>
      <div className="space-y-8">
        <SectionHeader
          title="Idea Intelligence"
          description="Review, score, and approve AI-generated ideas before scripting."
        />
        <EmptyState
          icon={Lightbulb}
          title="Idea review coming soon"
          description="Browse generated ideas, inspect ICE scores, and approve or reject them for scripting."
        />
      </div>
    </PageContainer>
  )
}
