import { useState, type FormEvent } from 'react'
import { Button, Card, Heading, Modal, Stack, Text } from '../ui'
import { useAuth } from './AuthProvider'
import { CredentialsForm } from './CredentialsForm'

const inputClass =
  'h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-text ' +
  'placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'

/** Account sheet: shows identity, lets a guest upgrade their account, and signs out. */
export function AccountMenu({ onClose }: { onClose: () => void }) {
  const { user, isGuest, linkGoogle, linkEmail, setDisplayName, signOutUser } = useAuth()
  const [showLinkEmail, setShowLinkEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linked, setLinked] = useState(false)
  const [name, setName] = useState(user?.displayName ?? '')
  const [renamed, setRenamed] = useState(false)

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

  async function submitName(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setRenamed(false)
    try {
      await setDisplayName(name)
      setRenamed(true)
    } catch (err) {
      setError((err as Error).message)
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

          {!isGuest && (
            <form onSubmit={submitName}>
              <Stack gap={2}>
                <Text size="sm" tone="muted">
                  Display name
                </Text>
                <input
                  className={inputClass}
                  type="text"
                  autoComplete="nickname"
                  placeholder="Your name"
                  maxLength={24}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setRenamed(false)
                  }}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  block
                  disabled={busy || name.trim() === (user?.displayName ?? '')}
                >
                  Save name
                </Button>
                {renamed && (
                  <Text size="sm" className="text-center text-brand">
                    Name updated — it’ll show in your next game.
                  </Text>
                )}
              </Stack>
            </form>
          )}

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
