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
import { Switch } from '@/components/ui/switch'
import { useApiErrorMessage } from '@/lib/api-utils'
import { domainsApi } from '@/lib/domains'
import { linksApi, type Link } from '@/lib/links'
import {
  DEFAULT_REDIRECT_STATUS,
  REDIRECT_STATUSES,
  SIMPLE_REDIRECT_STATUSES,
  type RedirectStatus,
} from '@/lib/links-schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
  const [domainId, setDomainId] = useState<number | null>(null)
  const [redirectStatus, setRedirectStatus] = useState<RedirectStatus>(
    props.link?.redirectStatus ?? DEFAULT_REDIRECT_STATUS,
  )
  // 302 has no simple-mode equivalent, so editing such a link starts in advanced mode.
  const [advanced, setAdvanced] = useState(props.link?.redirectStatus === 302)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setUrl(props.link?.url ?? '')
    setCode('')
    setDomainId(null)
    setRedirectStatus(props.link?.redirectStatus ?? DEFAULT_REDIRECT_STATUS)
    setAdvanced(props.link?.redirectStatus === 302)
    setError(null)
  }

  const domains = useQuery({ queryKey: ['domains'], queryFn: domainsApi.list, enabled: mode === 'create' && open })
  // Defaults to the first domain until the user picks one.
  const selectedDomainId = domainId ?? domains.data?.[0]?.id ?? null

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'create'
        ? linksApi.create({ domainId: selectedDomainId!, url, redirectStatus, code: code || undefined })
        : linksApi.update(props.link.id, { url, redirectStatus }),
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

  const domainItems = domains.data?.map(d => ({ label: d.host, value: d.id })) ?? []
  const redirectItems = advanced
    ? REDIRECT_STATUSES.map(value => ({ label: t(`linkForm.redirectStatus.advanced.${value}`), value }))
    : SIMPLE_REDIRECT_STATUSES.map(value => ({ label: t(`linkForm.redirectStatus.simple.${value}`), value }))

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
                <FieldLabel htmlFor="link-domain">{t('linkForm.domainLabel')}</FieldLabel>
                <Select
                  items={domainItems}
                  value={selectedDomainId}
                  onValueChange={value => value !== null && setDomainId(value)}
                  disabled={!domains.data?.length}
                >
                  <SelectTrigger id="link-domain" className="w-full">
                    <SelectValue placeholder={t('linkForm.domainPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {domainItems.map(item => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {domains.data?.length === 0 && <FieldDescription>{t('linkForm.noDomains')}</FieldDescription>}
              </Field>
            )}
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
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="link-status">{t('linkForm.statusLabel')}</FieldLabel>
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor="link-advanced" className="font-normal">
                    {t('linkForm.advancedMode')}
                  </FieldLabel>
                  <Switch
                    id="link-advanced"
                    size="sm"
                    checked={advanced}
                    onCheckedChange={checked => {
                      setAdvanced(checked)
                      if (!checked && redirectStatus === 302) setRedirectStatus(DEFAULT_REDIRECT_STATUS)
                    }}
                  />
                </div>
              </div>
              <Select
                items={redirectItems}
                value={redirectStatus}
                onValueChange={value => value !== null && setRedirectStatus(value as RedirectStatus)}
              >
                <SelectTrigger id="link-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {redirectItems.map(item => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
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
          <Button
            type="submit"
            form="link-form"
            disabled={mutation.isPending || (mode === 'create' && selectedDomainId === null)}
          >
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            {mode === 'create' ? t('linkForm.submitCreate') : t('linkForm.submitEdit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
