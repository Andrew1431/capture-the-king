import { useState, type FormEvent } from 'react'
import { Button, Stack } from '../ui'

const inputClass =
  'h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-text ' +
  'placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'

interface CredentialsFormProps {
  submitLabel: string
  busy?: boolean
  onSubmit: (email: string, password: string) => void | Promise<void>
}

/** Email + password fields shared by the login screen and the guest-upgrade flow. */
export function CredentialsForm({ submitLabel, busy, onSubmit }: CredentialsFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handle(e: FormEvent) {
    e.preventDefault()
    void onSubmit(email.trim(), password)
  }

  return (
    <form onSubmit={handle}>
      <Stack gap={3}>
        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={inputClass}
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" size="lg" block disabled={busy}>
          {submitLabel}
        </Button>
      </Stack>
    </form>
  )
}
