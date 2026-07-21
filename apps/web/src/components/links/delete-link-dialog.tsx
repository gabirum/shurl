import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Spinner } from '@/components/ui/spinner'
import { LinkApiError, linksApi } from '@/lib/links'

export function DeleteLinkDialog({
  code,
  open,
  onOpenChange,
}: {
  code: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => linksApi.remove(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] })
      toast.success(`Deleted ${code}`)
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      toast.error(err instanceof LinkApiError ? err.message : 'Failed to delete link')
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {code}?</AlertDialogTitle>
          <AlertDialogDescription>
            This short link will stop redirecting immediately. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
