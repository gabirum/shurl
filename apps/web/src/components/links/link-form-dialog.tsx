import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useApiErrorMessage, linksApi, type Link } from '@/lib/links'
import { REDIRECT_STATUSES, type RedirectStatus } from '@/lib/links-schema'

type LinkFormDialogProps =
  | { mode: 'create'; open: boolean; onOpenChange: (open: boolean) => void; link?: undefined }
  | { mode: 'edit'; open: boolean; onOpenChange: (open: boolean) => void; link: Link }

export function LinkFormDialog(props: LinkFormDialogProps) {
  const { mode, open, onOpenChange } = props
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const apiErrorMessage = useApiErrorMessage()

  const [url, setUrl] = useState(props.link?.url ?? '')
  const [code, setCode] = useState('')
  const [redirectStatus, setRedirectStatus] = useState<RedirectStatus>(props.link?.redirectStatus ?? 302)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setUrl(props.link?.url ?? '')
    setCode('')
    setRedirectStatus(props.link?.redirectStatus ?? 302)
    setError(null)
  }

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'create'
        ? linksApi.create({ url, redirectStatus, code: code || undefined })
        : linksApi.update(props.link.code, { url, redirectStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] })
      toast.success(mode === 'create' ? t('linkForm.createdToast') : t('linkForm.updatedToast'))
      onOpenChange(false)
      reset()
    },
    onError: (err: unknown) => {
      setError(apiErrorMessage(err))
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('linkForm.createTitle') : t('linkForm.editTitle', { code: props.link.code })}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' ? t('linkForm.createDescription') : t('linkForm.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <form
          id="link-form"
          onSubmit={e => {
            e.preventDefault()
            setError(null)
            mutation.mutate()
          }}
        >
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="link-url">{t('linkForm.urlLabel')}</FieldLabel>
              <Input
                id="link-url"
                type="url"
                required
                placeholder={t('linkForm.urlPlaceholder')}
                value={url}
                onChange={e => setUrl(e.target.value)}
                aria-invalid={!!error}
              />
            </Field>
            {mode === 'create' && (
              <Field>
                <FieldLabel htmlFor="link-code">{t('linkForm.aliasLabel')}</FieldLabel>
                <Input
                  id="link-code"
                  placeholder={t('linkForm.aliasPlaceholder')}
                  pattern="[A-Za-z0-9_-]{1,32}"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                />
                <FieldDescription>{t('linkForm.aliasHelp')}</FieldDescription>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="link-status">{t('linkForm.statusLabel')}</FieldLabel>
              <Select
                value={String(redirectStatus)}
                onValueChange={value => setRedirectStatus(Number(value) as RedirectStatus)}
              >
                <SelectTrigger id="link-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REDIRECT_STATUSES.map(status => (
                    <SelectItem key={status} value={String(status)}>
                      {t(`linkForm.redirectStatus.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t('linkForm.statusHelp')}</FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="link-form" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            {mode === 'create' ? t('linkForm.submitCreate') : t('linkForm.submitEdit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
