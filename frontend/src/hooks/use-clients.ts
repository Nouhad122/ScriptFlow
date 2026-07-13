import { useQuery } from '@tanstack/react-query'
import { getAllClients } from '@/services/clients.service'

export const clientsKey = ['clients', 'all'] as const

export function useClients() {
  return useQuery({
    queryKey: clientsKey,
    queryFn: getAllClients,
    staleTime: 60_000,
    retry: 1,
  })
}
