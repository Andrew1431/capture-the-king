import { useState } from 'react'
import { Button, Text } from '../ui'
import { AccountMenu } from './AccountMenu'
import { useAuth } from './AuthProvider'

/** Slim top strip showing who's signed in, with a tap target to open account actions. */
export function AccountBar() {
  const { user, isGuest } = useAuth()
  const [open, setOpen] = useState(false)
  const label = user?.displayName || user?.email || (isGuest ? 'Guest' : 'Player')

  return (
    <div className="flex items-center justify-between pb-4">
      <Text size="sm" tone="muted">
        {label}
        {isGuest && ' (guest)'}
      </Text>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Account
      </Button>
      {open && <AccountMenu onClose={() => setOpen(false)} />}
    </div>
  )
}
