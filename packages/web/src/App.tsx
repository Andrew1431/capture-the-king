import { useEffect, useRef } from 'react'
import { GameView } from './app/GameView'
import { Home } from './app/Home'
import { Inviting } from './app/Inviting'
import { Waiting } from './app/Waiting'
import { AccountBar, Login, useAuth } from './auth'
import { useGameSession } from './net/useGameSession'
import { Container, Text } from './ui'

// Capture a /join/<code> deep link once at load, before auth/React mount, then
// strip it from the URL so a refresh doesn't re-trigger the join.
const deepLinkCode = (() => {
  const m = window.location.pathname.match(/^\/join\/([A-Za-z0-9]{4,8})$/)
  if (!m) return null
  window.history.replaceState(null, '', '/')
  return m[1].toUpperCase()
})()

export function App() {
  const { user, loading } = useAuth()

  return (
    <Container className="py-6">
      {loading ? (
        <Text tone="muted" className="pt-20 text-center">
          Loading…
        </Text>
      ) : user ? (
        <GameApp />
      ) : (
        <Login />
      )}
    </Container>
  )
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

  // Now that the user is signed in, consume a /join/<code> deep link exactly once.
  useEffect(() => {
    if (deepLinkCode && !deepLinkUsed.current) {
      deepLinkUsed.current = true
      joinInvite(deepLinkCode)
    }
  }, [joinInvite])

  return (
    <>
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
    </>
  )
}
