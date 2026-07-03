import { cn } from '@/lib/utils'
import type { Status } from '@/types'

interface StatusConfig {
  label: string
  className: string
}

const statusMap: Record<Status, StatusConfig> = {
  pending: {
    label: 'Pending',
    className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-500/10 text-green-400 border border-green-500/20',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
  pending_review: {
    label: 'Pending Review',
    className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  },
  passed: {
    label: 'Passed',
    className: 'bg-green-500/10 text-green-400 border border-green-500/20',
  },
  held: {
    label: 'Held',
    className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  },
  PASS: {
    label: 'Pass',
    className: 'bg-green-500/10 text-green-400 border border-green-500/20',
  },
  HOLD: {
    label: 'Hold',
    className: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-500/10 text-green-400 border border-green-500/20',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
  },
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusMap[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
