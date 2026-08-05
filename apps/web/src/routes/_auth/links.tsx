import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { LinkIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DeleteLinkDialog } from '@/components/links/delete-link-dialog'
import { LinkFormDialog } from '@/components/links/link-form-dialog'
import { LinksTable } from '@/components/links/links-table'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsAdmin } from '@/lib/auth'
import { useApiErrorMessage, linksApi, type Link } from '@/lib/links'

export const Route = createFileRoute('/_auth/links')({ component: RouteComponent })

const PAGE_SIZE = 20

function RouteComponent() {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const apiErrorMessage = useApiErrorMessage()
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Link | null>(null)
  const [deleting, setDeleting] = useState<Link | null>(null)

  const query = useQuery({
    queryKey: ['links', page, PAGE_SIZE],
    queryFn: () => linksApi.list(page, PAGE_SIZE),
    placeholderData: prev => prev,
  })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('links.title')}</CardTitle>
          <CardAction>
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              {t('links.new')}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {query.isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <Empty>
              <EmptyMedia variant="icon">
                <LinkIcon />
              </EmptyMedia>
              <EmptyTitle>{t('links.loadError')}</EmptyTitle>
              <EmptyDescription>{apiErrorMessage(query.error)}</EmptyDescription>
              <EmptyContent>
                <Button variant="outline" onClick={() => query.refetch()}>
                  {t('common.tryAgain')}
                </Button>
              </EmptyContent>
            </Empty>
          ) : query.data.data.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <LinkIcon />
              </EmptyMedia>
              <EmptyTitle>{t('links.empty.title')}</EmptyTitle>
              <EmptyDescription>{t('links.empty.description')}</EmptyDescription>
              <EmptyContent>
                <Button onClick={() => setCreateOpen(true)}>
                  <PlusIcon data-icon="inline-start" />
                  {t('links.new')}
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <LinksTable links={query.data.data} showOwner={isAdmin} onEdit={setEditing} onDelete={setDeleting} />
              {(query.data.hasPrevious || query.data.hasNext) && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        text={t('links.pagination.previous')}
                        aria-label={t('links.pagination.previous')}
                        aria-disabled={!query.data.hasPrevious}
                        className={!query.data.hasPrevious ? 'pointer-events-none opacity-50' : undefined}
                        onClick={e => {
                          e.preventDefault()
                          if (query.data.hasPrevious) setPage(p => p - 1)
                        }}
                        href="#"
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        text={t('links.pagination.next')}
                        aria-label={t('links.pagination.next')}
                        aria-disabled={!query.data.hasNext}
                        className={!query.data.hasNext ? 'pointer-events-none opacity-50' : undefined}
                        onClick={e => {
                          e.preventDefault()
                          if (query.data.hasNext) setPage(p => p + 1)
                        }}
                        href="#"
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <LinkFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />
      {editing && (
        <LinkFormDialog mode="edit" link={editing} open={!!editing} onOpenChange={open => !open && setEditing(null)} />
      )}
      {deleting && (
        <DeleteLinkDialog code={deleting.code} open={!!deleting} onOpenChange={open => !open && setDeleting(null)} />
      )}
    </div>
  )
}
