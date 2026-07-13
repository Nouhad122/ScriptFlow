import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { updateClient } from '@/services/clients.service'
import { clientsKey } from '@/hooks/use-clients'
import type { ClientContext } from '@/types'

export function useUpdateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (client: ClientContext) => updateClient(client.id, client),
    onSuccess: () => {
      toast.success('Client saved.')
      void queryClient.invalidateQueries({ queryKey: clientsKey })
    },
    onError: () => {
      toast.error('Failed to save client.')
    },
  })
}
