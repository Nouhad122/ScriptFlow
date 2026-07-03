import apiClient from '@/lib/axios'
import type { Idea } from '@/types'

interface PendingIdeasResponse {
  success: boolean
  count: number
  ideas: Idea[]
}

interface ApprovalResponse {
  success: boolean
  idea: Idea
}

export async function getPendingIdeas(): Promise<Idea[]> {
  const { data } = await apiClient.get<PendingIdeasResponse>('/api/ideas/pending')
  return data.ideas
}

export async function getApprovedIdeas(): Promise<Idea[]> {
  const { data } = await apiClient.get<PendingIdeasResponse>('/api/ideas/approved')
  return data.ideas
}

export async function approveIdea(id: string): Promise<Idea> {
  const { data } = await apiClient.patch<ApprovalResponse>(`/api/ideas/${id}/approval`, {
    status: 'approved',
  })
  return data.idea
}

export async function rejectIdea(id: string): Promise<Idea> {
  const { data } = await apiClient.patch<ApprovalResponse>(`/api/ideas/${id}/approval`, {
    status: 'rejected',
  })
  return data.idea
}
