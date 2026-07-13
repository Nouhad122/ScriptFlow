import apiClient from '@/lib/axios'
import type { ClientContext } from '@/types'

interface ClientsResponse {
  success: boolean
  clients: ClientContext[]
}

interface ClientResponse {
  success: boolean
  client: ClientContext
}

export async function getAllClients(): Promise<ClientContext[]> {
  const { data } = await apiClient.get<ClientsResponse>('/api/clients')
  return data.clients
}

export async function createClient(
  body: Omit<ClientContext, 'id'>,
): Promise<ClientContext> {
  const { data } = await apiClient.post<ClientResponse>('/api/clients', body)
  return data.client
}

export async function updateClient(
  id: string,
  body: ClientContext,
): Promise<ClientContext> {
  const { data } = await apiClient.put<ClientResponse>(`/api/clients/${id}`, body)
  return data.client
}

export async function deleteClient(id: string): Promise<void> {
  await apiClient.delete(`/api/clients/${id}`)
}
