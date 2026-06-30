import { getIdToken } from 'firebase/auth'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@ctk/protocol'
import { firebaseAuth } from '../auth/firebase'

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * Create a (not-yet-connected) typed socket. The handshake auth is a function so a
 * fresh Firebase ID token is fetched on every (re)connect, surviving token refresh.
 */
export function createSocket(): AppSocket {
  const url = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080'
  return io(url, {
    transports: ['websocket'],
    autoConnect: false,
    auth: (cb) => {
      const user = firebaseAuth.currentUser
      if (!user) return cb({ token: '' })
      void getIdToken(user).then(
        (token) => cb({ token }),
        () => cb({ token: '' }),
      )
    },
  })
}
