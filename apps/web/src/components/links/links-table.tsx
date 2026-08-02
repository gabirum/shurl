import { useState } from 'react'
import { CopyIcon, MoreHorizontalIcon, PencilIcon, TrashIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Link } from '@/lib/links'
import { PERMANENT_REDIRECT_STATUS } from '@/lib/links-schema'
import { LinkStatusBadge } from './link-status-badge'

function CopyCodeButton({ shortUrl }: { shortUrl: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              void navigator.clipboard.writeText(shortUrl)
              toast.success('Short URL copied')
            }}
          />
        }
      >
        <CopyIcon />
        <span className="sr-only">Copy short URL</span>
      </TooltipTrigger>
      <TooltipContent>Copy short URL</TooltipContent>
    </Tooltip>
  )
}

function OwnerCell({ link }: { link: Link }) {
  const label = link.ownerUsername ?? `${link.owner.slice(0, 8)}…`
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="block max-w-32 truncate text-muted-foreground" />}>
        {label}
      </TooltipTrigger>
      <TooltipContent>{link.owner}</TooltipContent>
    </Tooltip>
  )
}

export function LinksTable({
  links,
  showOwner = false,
  onEdit,
  onDelete,
}: {
  links: Link[]
  showOwner?: boolean
  onEdit: (link: Link) => void
  onDelete: (link: Link) => void
}) {
  const [openMenuCode, setOpenMenuCode] = useState<string | null>(null)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Destination</TableHead>
          <TableHead>Status</TableHead>
          {showOwner && <TableHead>Owner</TableHead>}
          <TableHead className="text-right">Clicks</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-9" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {links.map(link => {
          const immutable = link.redirectStatus === PERMANENT_REDIRECT_STATUS
          return (
            <TableRow key={link.code}>
              <TableCell>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-sm">{link.code}</span>
                  <CopyCodeButton shortUrl={link.shortUrl} />
                </div>
              </TableCell>
              <TableCell className="max-w-xs">
                {/^https?:\/\//i.test(link.url) ? (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-foreground underline-offset-4 hover:underline"
                    title={link.url}
                  >
                    {link.url}
                  </a>
                ) : (
                  <span className="block truncate text-muted-foreground" title={link.url}>
                    {link.url}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <LinkStatusBadge status={link.redirectStatus} />
              </TableCell>
              {showOwner && (
                <TableCell>
                  <OwnerCell link={link} />
                </TableCell>
              )}
              <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                {link.accessCount.toLocaleString()}
              </TableCell>
              <TableCell className="text-muted-foreground">{new Date(link.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <DropdownMenu
                  open={openMenuCode === link.code}
                  onOpenChange={o => setOpenMenuCode(o ? link.code : null)}
                >
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontalIcon />
                        <span className="sr-only">Actions for {link.code}</span>
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        disabled={immutable}
                        onClick={() => {
                          setOpenMenuCode(null)
                          onEdit(link)
                        }}
                      >
                        <PencilIcon data-icon="inline-start" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={immutable}
                        onClick={() => {
                          setOpenMenuCode(null)
                          onDelete(link)
                        }}
                      >
                        <TrashIcon data-icon="inline-start" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
