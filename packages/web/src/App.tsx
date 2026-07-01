import { useEffect, useRef } from 'react'
import { GameView } from './app/GameView'
import { Home } from './app/Home'
import { Inviting } from './app/Inviting'
import { Waiting } from './app/Waiting'
import { AccountBar, Login, useAuth } from './auth'
import { useGameSession } from './net/useGameSession'
import { cn } from './lib/cn'
import { Button, Card, Container, Heading, Loader, Modal, Stack, Text } from './ui'

// Capture a /join/<code> deep link once at load, before auth/React mount. We stash it
// in sessionStorage (so it survives the login screen and any full-page reload during
// sign-in) plus a module var (so it still works if storage is blocked), then strip it
// from the URL so a refresh doesn't re-trigger the join.
const JOIN_KEY = 'ctk:pendingJoin'
let pendingJoinCode: string | null = null

;(() => {
  const m = window.location.pathname.match(/^\/join\/([A-Za-z0-9]{4,8})$/)
  if (!m) return
  pendingJoinCode = m[1].toUpperCase()
  try {
    sessionStorage.setItem(JOIN_KEY, pendingJoinCode)
  } catch {
    // Storage blocked (private mode) — the module var still carries it for this load.
  }
  window.history.replaceState(null, '', '/')
})()

function readPendingJoin(): string | null {
  if (pendingJoinCode) return pendingJoinCode
  try {
    return sessionStorage.getItem(JOIN_KEY)
  } catch {
    return null
  }
}

function clearPendingJoin() {
  pendingJoinCode = null
  try {
    sessionStorage.removeItem(JOIN_KEY)
  } catch {
    // ignore
  }
}

export function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Container className="py-6">
        <Stack gap={4} align="center" justify="center" className="min-h-[70dvh]">
          <Loader />
          <Text tone="muted" className="font-display tracking-widest uppercase">
            Setting the board
          </Text>
        </Stack>
      </Container>
    )
  }
  if (!user) {
    return (
      <Container className="py-6">
        <Login />
      </Container>
    )
  }
  return <GameApp />
}

/** The authenticated experience: account bar + the live game session. */
function GameApp() {
  const session = useGameSession()
  const { error, dismissError, joinInvite } = session
  const deepLinkUsed = useRef(false)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(dismissError, 3000)
    return () => clearTimeout(t)
  }, [error, dismissError])

  // Now that the user is signed in, consume a pending /join/<code> invite. The guard
  // resets on cleanup so React StrictMode's mount→unmount→remount (dev) re-issues the
  // join on the live socket instead of dropping it against the torn-down one.
  useEffect(() => {
    const code = readPendingJoin()
    if (!code || deepLinkUsed.current) return
    deepLinkUsed.current = true
    joinInvite(code)
    return () => {
      deepLinkUsed.current = false
    }
  }, [joinInvite])

  // Once we've actually entered a game, drop the stored invite so it can't replay
  // (e.g. after a later sign-out/sign-in in the same tab).
  useEffect(() => {
    if (session.phase === 'playing' || session.phase === 'over') clearPendingJoin()
  }, [session.phase])

  // Widen the column in-game so the move-history panel sits beside the board on desktop.
  const inGame = session.phase === 'playing' || session.phase === 'over'

  return (
    <Container className={cn('py-6', inGame && 'lg:max-w-4xl')}>
      <AccountBar />

      {session.phase === 'home' && (
        <Home
          onPlay={session.play}
          onCreateInvite={session.createInvite}
          onJoinCode={session.joinInvite}
        />
      )}
      {session.phase === 'queueing' && <Waiting conn={session.conn} onCancel={session.cancel} />}
      {session.phase === 'inviting' && (
        <Inviting code={session.inviteCode} onCancel={session.cancel} />
      )}
      {(session.phase === 'playing' || session.phase === 'over') && <GameView session={session} />}

      {error && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="rounded-xl border border-danger/40 bg-surface px-4 py-2 text-sm text-text shadow-lg">
            {error}
          </div>
        </div>
      )}

      {session.noOpponent && (
        <Modal onClose={session.dismissNoOpponent}>
          <Card>
            <Stack gap={4} align="center" className="text-center">
              <Stack gap={1} align="center">
                <Heading level={2}>No one's around</Heading>
                <Text tone="muted">
                  It seems like no one is playing right now. Try again in a bit.
                </Text>
              </Stack>
              <Button block onClick={session.dismissNoOpponent}>
                Back to menu
              </Button>
            </Stack>
          </Card>
        </Modal>
      )}
    </Container>
  )
}
