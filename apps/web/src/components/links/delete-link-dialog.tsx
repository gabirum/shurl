import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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
import { useApiErrorMessage, linksApi, type Link } from '@/lib/links'

export function DeleteLinkDialog({
  link,
  open,
  onOpenChange,
}: {
  link: Link
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const code = `${link.domain}/${link.code}`
  const queryClient = useQueryClient()
  const apiErrorMessage = useApiErrorMessage()

  const mutation = useMutation({
    mutationFn: () => linksApi.remove(link.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] })
      toast.success(t('deleteLink.deletedToast', { code }))
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err) || t('deleteLink.errorToast'))
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteLink.title', { code })}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteLink.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
