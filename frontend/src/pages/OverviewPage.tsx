import { GitBranch, Lightbulb, FileText, ShieldCheck } from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { SectionHeader } from '@/components/SectionHeader'
import { StatCard } from '@/components/StatCard'

export function OverviewPage() {
  return (
    <PageContainer>
      <div className="space-y-8">
        <SectionHeader
          title="Overview"
          description="Monitor your content pipeline performance at a glance."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Pipeline Runs" value={0} icon={GitBranch} description="Total runs" />
          <StatCard label="Ideas Generated" value={0} icon={Lightbulb} description="Across all runs" />
          <StatCard label="Scripts Generated" value={0} icon={FileText} description="Ready for review" />
          <StatCard label="Passed Quality" value={0} icon={ShieldCheck} description="Cleared for delivery" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <StatCard label="Pending Approval" value={0} description="Awaiting human review" />
          <StatCard label="Approved Ideas" value={0} description="Ready to script" />
          <StatCard label="Held Scripts" value={0} description="Flagged by quality review" />
        </div>
      </div>
    </PageContainer>
  )
}
