import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@ctk/protocol'
import { loadGuest } from './identity'

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** Create a (not-yet-connected) typed socket carrying the guest identity. */
export function createSocket(): AppSocket {
  const guest = loadGuest()
  const url = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080'
  return io(url, {
    transports: ['websocket'],
    autoConnect: false,
    auth: { uid: guest.uid, name: guest.name },
  })
}
