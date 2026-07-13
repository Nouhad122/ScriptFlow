import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/services/clients.service'
import { clientsKey } from '@/hooks/use-clients'
import type { ClientContext } from '@/types'

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<ClientContext, 'id'>) => createClient(data),
    onSuccess: () => {
      toast.success('Client created.')
      void queryClient.invalidateQueries({ queryKey: clientsKey })
    },
    onError: () => {
      toast.error('Failed to create client.')
    },
  })
}
