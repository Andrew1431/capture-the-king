import { useState } from 'react'
import { Button, Card, Heading, Modal, Stack, Text } from '../ui'
import { useAuth } from './AuthProvider'
import { CredentialsForm } from './CredentialsForm'

/** Account sheet: shows identity, lets a guest upgrade their account, and signs out. */
export function AccountMenu({ onClose }: { onClose: () => void }) {
  const { user, isGuest, linkGoogle, linkEmail, signOutUser } = useAuth()
  const [showLinkEmail, setShowLinkEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linked, setLinked] = useState(false)

  const label = user?.displayName || user?.email || (isGuest ? 'Guest' : 'Player')

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setLinked(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <Card>
        <Stack gap={4}>
          <Stack gap={1}>
            <Heading level={3}>Account</Heading>
            <Text size="sm" tone="muted">
              Signed in as {label}
              {isGuest && ' (guest)'}
            </Text>
          </Stack>

          {isGuest && !linked && (
            <Stack gap={3}>
              <Text size="sm" tone="muted">
                Save your progress — upgrade this guest to a permanent account.
              </Text>
              <Button variant="secondary" block disabled={busy} onClick={() => run(linkGoogle)}>
                Link Google account
              </Button>
              {showLinkEmail ? (
                <CredentialsForm
                  submitLabel="Link email account"
                  busy={busy}
                  onSubmit={(email, password) => run(() => linkEmail(email, password))}
                />
              ) : (
                <Button variant="ghost" size="sm" block onClick={() => setShowLinkEmail(true)}>
                  Link email &amp; password instead
                </Button>
              )}
            </Stack>
          )}

          {linked && (
            <Text size="sm" className="text-center text-brand">
              Account saved — you can sign in with it next time.
            </Text>
          )}

          {error && (
            <Text size="sm" className="text-center text-danger">
              {error}
            </Text>
          )}

          <Button variant="ghost" block disabled={busy} onClick={() => void signOutUser()}>
            Sign out
          </Button>
        </Stack>
      </Card>
    </Modal>
  )
}
