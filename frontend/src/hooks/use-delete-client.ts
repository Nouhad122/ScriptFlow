import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deleteClient } from '@/services/clients.service'
import { clientsKey } from '@/hooks/use-clients'

export function useDeleteClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      toast.success('Client deleted.')
      void queryClient.invalidateQueries({ queryKey: clientsKey })
    },
    onError: () => {
      toast.error('Failed to delete client.')
    },
  })
}
