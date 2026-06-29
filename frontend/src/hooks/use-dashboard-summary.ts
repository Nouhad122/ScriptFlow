import { useQuery } from '@tanstack/react-query'
import { getDashboardSummary } from '@/services/dashboard.service'

export const dashboardSummaryKey = ['dashboard', 'summary'] as const

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardSummaryKey,
    queryFn: getDashboardSummary,
  })
}
