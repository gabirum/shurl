import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PERMANENT_REDIRECT_STATUS, type RedirectStatus } from '@/lib/links-schema'

export function LinkStatusBadge({ status }: { status: RedirectStatus }) {
  const { t } = useTranslation()

  if (status === PERMANENT_REDIRECT_STATUS) {
    return (
      <Tooltip>
        <TooltipTrigger render={<Badge variant="outline" className="gap-1 text-muted-foreground" />}>
          <Lock data-icon="inline-start" />
          {status}
        </TooltipTrigger>
        <TooltipContent>{t('status.permanentTooltip')}</TooltipContent>
      </Tooltip>
    )
  }

  return <Badge variant="secondary">{status}</Badge>
}
