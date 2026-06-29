import apiClient from '@/lib/axios'
import type { DashboardSummary } from '@/types'

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary & { success: boolean }>(
    '/api/dashboard/summary',
  )
  return data
}
