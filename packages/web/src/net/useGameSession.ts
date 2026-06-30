import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { Color, GameState, Move, PieceType } from '@ctk/engine'
import type { GameOverPayload, GameSnapshot, PlayerInfo } from '@ctk/protocol'
import { createSocket, type AppSocket } from './socket'

/** Socket connection phase. 'waking' covers scale-to-zero cold starts. */
export type ConnPhase = 'idle' | 'connecting' | 'waking' | 'online' | 'offline'

/** Where the player is in the flow. */
export type SessionPhase = 'home' | 'queueing' | 'playing' | 'over'

export interface ActiveGame {
  gameId: string
  color: Color
  players: { w: PlayerInfo; b: PlayerInfo }
  state: GameState
  lastMove: Move | null
}

interface SessionState {
  conn: ConnPhase
  phase: SessionPhase
  game: ActiveGame | null
  result: GameOverPayload | null
  error: string | null
}

const initialState: SessionState = {
  conn: 'idle',
  phase: 'home',
  game: null,
  result: null,
  error: null,
}

type Action =
  | { type: 'conn'; phase: ConnPhase }
  | { type: 'start-queue' }
  | { type: 'start'; snapshot: GameSnapshot }
  | { type: 'state'; state: GameState; lastMove: Move | null }
  | { type: 'over'; result: GameOverPayload }
  | { type: 'error'; message: string | null }
  | { type: 'reset' }

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'conn':
      return { ...state, conn: action.phase }
    case 'start-queue':
      return { ...state, conn: 'connecting', phase: 'queueing', game: null, result: null }
    case 'start':
      return {
        ...state,
        phase: 'playing',
        result: null,
        game: {
          gameId: action.snapshot.gameId,
          color: action.snapshot.color,
          players: action.snapshot.players,
          state: action.snapshot.state,
          lastMove: action.snapshot.lastMove,
        },
      }
    case 'state':
      if (!state.game) return state
      return { ...state, game: { ...state.game, state: action.state, lastMove: action.lastMove } }
    case 'over':
      return { ...state, phase: 'over', result: action.result }
    case 'error':
      return { ...state, error: action.message }
    case 'reset':
      return { ...initialState, conn: state.conn }
    default:
      return state
  }
}

export interface GameSession extends SessionState {
  play: () => void
  cancel: () => void
  sendMove: (from: number, to: number, promo?: PieceType) => void
  resign: () => void
  newGame: () => void
  dismissError: () => void
}

export function useGameSession(): GameSession {
  const [state, dispatch] = useReducer(reducer, initialState)
  const socketRef = useRef<AppSocket | null>(null)
  const pendingQueue = useRef(false)
  const wakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const socket = createSocket()
    socketRef.current = socket

    socket.on('connect', () => {
      clearTimeout(wakeTimer.current)
      dispatch({ type: 'conn', phase: 'online' })
      if (pendingQueue.current) {
        socket.emit('queue:join')
        pendingQueue.current = false
      }
    })
    socket.on('disconnect', () => dispatch({ type: 'conn', phase: 'offline' }))
    socket.io.on('reconnect_attempt', () => dispatch({ type: 'conn', phase: 'waking' }))

    socket.on('game:start', (snapshot) => dispatch({ type: 'start', snapshot }))
    socket.on('state', ({ state: s, lastMove }) => dispatch({ type: 'state', state: s, lastMove }))
    socket.on('game:over', (result) => dispatch({ type: 'over', result }))
    socket.on('error:msg', ({ message }) => dispatch({ type: 'error', message }))

    return () => {
      clearTimeout(wakeTimer.current)
      socket.removeAllListeners()
      socket.io.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const play = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    dispatch({ type: 'start-queue' })
    wakeTimer.current = setTimeout(() => dispatch({ type: 'conn', phase: 'waking' }), 1500)
    if (socket.connected) {
      socket.emit('queue:join')
    } else {
      pendingQueue.current = true
      socket.connect()
    }
  }, [])

  const cancel = useCallback(() => {
    const socket = socketRef.current
    pendingQueue.current = false
    clearTimeout(wakeTimer.current)
    socket?.emit('queue:leave')
    socket?.disconnect()
    dispatch({ type: 'reset' })
  }, [])

  const sendMove = useCallback((from: number, to: number, promo?: PieceType) => {
    socketRef.current?.emit('move', { from, to, promo })
  }, [])

  const resign = useCallback(() => {
    socketRef.current?.emit('resign')
  }, [])

  const newGame = useCallback(() => {
    socketRef.current?.disconnect()
    dispatch({ type: 'reset' })
  }, [])

  const dismissError = useCallback(() => dispatch({ type: 'error', message: null }), [])

  return { ...state, play, cancel, sendMove, resign, newGame, dismissError }
}
