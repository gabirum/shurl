import { createFileRoute, Outlet } from '@tanstack/react-router'
import { LinkIcon, LogOutIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { enforceLogin, useOidc } from '@/oidc'

export const Route = createFileRoute('/_auth')({ beforeLoad: enforceLogin, component: RouteComponent })

function RouteComponent() {
  const { t } = useTranslation()
  const { decodedIdToken, logout } = useOidc({ assert: 'user logged in' })

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2 font-heading font-medium">
          <LinkIcon className="size-4 text-primary" />
          shurl
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{decodedIdToken.preferred_username}</span>
          <Separator orientation="vertical" className="h-5" />
          <LanguageSwitcher />
          <Separator orientation="vertical" className="h-5" />
          <Button variant="ghost" size="sm" onClick={() => logout({ redirectTo: 'home' })}>
            <LogOutIcon data-icon="inline-start" />
            {t('header.logout')}
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
