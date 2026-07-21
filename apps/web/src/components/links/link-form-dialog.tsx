import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
import { LinkApiError, linksApi, type Link } from '@/lib/links'
import { REDIRECT_STATUSES, REDIRECT_STATUS_LABELS, type RedirectStatus } from '@/lib/links-schema'

type LinkFormDialogProps =
  | { mode: 'create'; open: boolean; onOpenChange: (open: boolean) => void; link?: undefined }
  | { mode: 'edit'; open: boolean; onOpenChange: (open: boolean) => void; link: Link }

export function LinkFormDialog(props: LinkFormDialogProps) {
  const { mode, open, onOpenChange } = props
  const queryClient = useQueryClient()

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
      toast.success(mode === 'create' ? 'Link created' : 'Link updated')
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      setError(err instanceof LinkApiError ? err.message : 'Something went wrong')
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
          <DialogTitle>{mode === 'create' ? 'New link' : `Edit ${props.link.code}`}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Point a short code at a destination URL.'
              : 'Change the destination or how it redirects.'}
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
              <FieldLabel htmlFor="link-url">Destination URL</FieldLabel>
              <Input
                id="link-url"
                type="url"
                required
                placeholder="https://example.com/some/path"
                value={url}
                onChange={e => setUrl(e.target.value)}
                aria-invalid={!!error}
              />
            </Field>
            {mode === 'create' && (
              <Field>
                <FieldLabel htmlFor="link-code">Custom alias (optional)</FieldLabel>
                <Input
                  id="link-code"
                  placeholder="my-link"
                  pattern="[A-Za-z0-9_-]{1,32}"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                />
                <FieldDescription>
                  Letters, numbers, - and _. A random code is generated if left blank.
                </FieldDescription>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="link-status">Redirect type</FieldLabel>
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
                      {REDIRECT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Permanent (308) links can never be edited or deleted afterward — choose it deliberately.
              </FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="link-form" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            {mode === 'create' ? 'Create link' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
