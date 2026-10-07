import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { GlobeIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { domainsApi, type Domain } from '@/lib/domains'
import { useApiErrorMessage } from '@/lib/links'
import { useIsAdmin } from '@/lib/auth'

export const Route = createFileRoute('/_auth/domains')({ component: RouteComponent })

function CreateDomainDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const apiErrorMessage = useApiErrorMessage()
  const [host, setHost] = useState('')
  const [scheme, setScheme] = useState<'http' | 'https'>('https')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setHost('')
    setScheme('https')
    setError(null)
  }

  const mutation = useMutation({
    mutationFn: () => domainsApi.create({ host, scheme }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] })
      toast.success(t('domains.createdToast'))
      onOpenChange(false)
      reset()
    },
    onError: (err: unknown) => setError(apiErrorMessage(err)),
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
          <DialogTitle>{t('domains.createTitle')}</DialogTitle>
          <DialogDescription>{t('domains.createDescription')}</DialogDescription>
        </DialogHeader>
        <form
          id="domain-form"
          onSubmit={e => {
            e.preventDefault()
            setError(null)
            mutation.mutate()
          }}
        >
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="domain-host">{t('domains.hostLabel')}</FieldLabel>
              <Input
                id="domain-host"
                required
                placeholder="sh.example.com"
                value={host}
                onChange={e => setHost(e.target.value)}
                aria-invalid={!!error}
              />
              <FieldDescription>{t('domains.hostHelp')}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="domain-scheme">{t('domains.schemeLabel')}</FieldLabel>
              <Select value={scheme} onValueChange={value => setScheme(value as 'http' | 'https')}>
                <SelectTrigger id="domain-scheme" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="https">https</SelectItem>
                  <SelectItem value="http">http</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="domain-form" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            {t('domains.submitCreate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDomainDialog({ domain, onClose }: { domain: Domain; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const apiErrorMessage = useApiErrorMessage()

  const mutation = useMutation({
    mutationFn: () => domainsApi.remove(domain.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] })
      toast.success(t('domains.deletedToast', { host: domain.host }))
      onClose()
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err)),
  })

  return (
    <AlertDialog open onOpenChange={open => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('domains.deleteTitle', { host: domain.host })}</AlertDialogTitle>
          <AlertDialogDescription>{t('domains.deleteDescription')}</AlertDialogDescription>
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

function RouteComponent() {
  const { t, i18n } = useTranslation()
  const isAdmin = useIsAdmin()
  const apiErrorMessage = useApiErrorMessage()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleting, setDeleting] = useState<Domain | null>(null)
  const query = useQuery({ queryKey: ['domains'], queryFn: domainsApi.list, enabled: isAdmin })

  // Server-side admin checks are authoritative; this only keeps non-admins off a page that can't work for them.
  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Empty>
          <EmptyMedia variant="icon">
            <GlobeIcon />
          </EmptyMedia>
          <EmptyTitle>{t('domains.forbidden')}</EmptyTitle>
        </Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('domains.title')}</CardTitle>
          <CardAction>
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              {t('domains.new')}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <Skeleton className="h-11 w-full" />
          ) : query.isError ? (
            <Empty>
              <EmptyTitle>{t('domains.loadError')}</EmptyTitle>
              <EmptyDescription>{apiErrorMessage(query.error)}</EmptyDescription>
            </Empty>
          ) : query.data.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <GlobeIcon />
              </EmptyMedia>
              <EmptyTitle>{t('domains.empty.title')}</EmptyTitle>
              <EmptyDescription>{t('domains.empty.description')}</EmptyDescription>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('domains.table.host')}</TableHead>
                  <TableHead>{t('domains.table.scheme')}</TableHead>
                  <TableHead>{t('links.table.created')}</TableHead>
                  <TableHead className="w-9" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.map(domain => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-mono text-sm">{domain.host}</TableCell>
                    <TableCell className="text-muted-foreground">{domain.scheme}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(domain.createdAt).toLocaleDateString(i18n.language)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-xs" onClick={() => setDeleting(domain)}>
                        <TrashIcon />
                        <span className="sr-only">{t('common.delete')}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateDomainDialog open={createOpen} onOpenChange={setCreateOpen} />
      {deleting && <DeleteDomainDialog domain={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}
