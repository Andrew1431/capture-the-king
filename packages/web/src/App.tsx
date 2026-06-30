import { useEffect } from 'react'
import { GameView } from './app/GameView'
import { Home } from './app/Home'
import { Waiting } from './app/Waiting'
import { AccountBar, Login, useAuth } from './auth'
import { useGameSession } from './net/useGameSession'
import { Container, Text } from './ui'

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
  const { error, dismissError } = session

  useEffect(() => {
    if (!error) return
    const t = setTimeout(dismissError, 3000)
    return () => clearTimeout(t)
  }, [error, dismissError])

  return (
    <>
      <AccountBar />

      {session.phase === 'home' && <Home onPlay={session.play} />}
      {session.phase === 'queueing' && <Waiting conn={session.conn} onCancel={session.cancel} />}
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
