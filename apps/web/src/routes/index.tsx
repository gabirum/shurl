import { createFileRoute, Link } from '@tanstack/react-router'
import { LinkIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: RouteComponent })

function RouteComponent() {
  const { t } = useTranslation()

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="flex items-center gap-2 font-heading text-2xl font-medium">
        <LinkIcon className="size-6 text-primary" />
        shurl
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">{t('landing.tagline')}</p>
      <Button nativeButton={false} render={<Link to="/links">{t('landing.openDashboard')}</Link>} />
    </div>
  )
}
