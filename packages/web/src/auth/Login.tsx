import { useState } from 'react'
import { BuyMeACoffeeLink, Button, Card, DiscordLink, GithubLink, Heading, Stack, Text } from '../ui'
import { useAuth } from './AuthProvider'
import { CredentialsForm } from './CredentialsForm'

type Mode = 'signin' | 'register'

/** Pre-game gate: Google, email/password, or anonymous guest sign-in. */
export function Login() {
  const { signInGoogle, signInEmail, registerEmail, signInGuest } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack gap={6}>
      <Stack gap={2} align="center" className="text-center">
        <Heading level={1}>
          Capture the <span className="text-brand">King</span>
        </Heading>
        <Text tone="muted">Sign in to play. Guests are welcome — no account needed.</Text>
      </Stack>

      <Card>
        <Stack gap={4}>
          <Button size="lg" variant="secondary" block disabled={busy} onClick={() => run(signInGoogle)}>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-muted">
            <span className="h-px flex-1 bg-border" />
            <Text size="sm" tone="muted">
              or
            </Text>
            <span className="h-px flex-1 bg-border" />
          </div>

          <CredentialsForm
            submitLabel={mode === 'signin' ? 'Sign in' : 'Create account'}
            busy={busy}
            onSubmit={(email, password) =>
              run(() => (mode === 'signin' ? signInEmail : registerEmail)(email, password))
            }
          />

          <Button
            variant="ghost"
            size="sm"
            block
            onClick={() => {
              setError(null)
              setMode((m) => (m === 'signin' ? 'register' : 'signin'))
            }}
          >
            {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
          </Button>

          {error && (
            <Text size="sm" className="text-center text-danger">
              {error}
            </Text>
          )}
        </Stack>
      </Card>

      <Button variant="ghost" block disabled={busy} onClick={() => run(signInGuest)}>
        Continue as guest
      </Button>

      <div className="flex justify-center gap-1">
        <BuyMeACoffeeLink />
        <DiscordLink />
        <GithubLink />
      </div>
    </Stack>
  )
}
