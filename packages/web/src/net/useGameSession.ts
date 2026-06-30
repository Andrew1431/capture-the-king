import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { Color, GameState, Move, PieceType } from '@ctk/engine'
import type { GameOverPayload, GameSnapshot, InviteJoinResult, PlayerInfo } from '@ctk/protocol'
import { createSocket, type AppSocket } from './socket'

/** Socket connection phase. 'waking' covers scale-to-zero cold starts. */
export type ConnPhase = 'idle' | 'connecting' | 'waking' | 'online' | 'offline'

/** Where the player is in the flow. */
export type SessionPhase = 'home' | 'queueing' | 'inviting' | 'playing' | 'over'

export interface ActiveGame {
  gameId: string
  color: Color
  players: { w: PlayerInfo; b: PlayerInfo }
  state: GameState
  lastMove: Move | null
  /** Full ordered move history of this game, for the move list. */
  moves: Move[]
}

/** What to do once the socket connects (it autoConnects lazily on the first action). */
type PendingAction = { kind: 'queue' } | { kind: 'create' } | { kind: 'join'; code: string }

interface SessionState {
  conn: ConnPhase
  phase: SessionPhase
  game: ActiveGame | null
  result: GameOverPayload | null
  inviteCode: string | null
  error: string | null
}

const initialState: SessionState = {
  conn: 'idle',
  phase: 'home',
  game: null,
  result: null,
  inviteCode: null,
  error: null,
}

type Action =
  | { type: 'conn'; phase: ConnPhase }
  | { type: 'start-queue' }
  | { type: 'start-invite' }
  | { type: 'invite-code'; code: string }
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
    case 'start-invite':
      return {
        ...state,
        conn: 'connecting',
        phase: 'inviting',
        game: null,
        result: null,
        inviteCode: null,
      }
    case 'invite-code':
      return { ...state, phase: 'inviting', inviteCode: action.code }
    case 'start':
      return {
        ...state,
        phase: 'playing',
        result: null,
        inviteCode: null,
        game: {
          gameId: action.snapshot.gameId,
          color: action.snapshot.color,
          players: action.snapshot.players,
          state: action.snapshot.state,
          lastMove: action.snapshot.lastMove,
          moves: action.snapshot.moves,
        },
      }
    case 'state': {
      if (!state.game) return state
      // Each 'state' carries one newly-applied move; append it to the history.
      const moves = action.lastMove ? [...state.game.moves, action.lastMove] : state.game.moves
      return {
        ...state,
        game: { ...state.game, state: action.state, lastMove: action.lastMove, moves },
      }
    }
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

type InviteFailReason = Extract<InviteJoinResult, { ok: false }>['reason']

function inviteError(reason: InviteFailReason): string {
  if (reason === 'expired') return 'That invite code has expired.'
  if (reason === 'full') return 'That game is already full.'
  return "We couldn't find that invite code."
}

export interface GameSession extends SessionState {
  play: () => void
  createInvite: () => void
  joinInvite: (code: string) => void
  cancel: () => void
  sendMove: (from: number, to: number, promo?: PieceType) => void
  resign: () => void
  newGame: () => void
  dismissError: () => void
}

export function useGameSession(): GameSession {
  const [state, dispatch] = useReducer(reducer, initialState)
  const socketRef = useRef<AppSocket | null>(null)
  const pending = useRef<PendingAction | null>(null)
  const wakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Emit the queued intent. Acks drive invite results; game:start drives the rest.
  const runAction = useCallback((socket: AppSocket, action: PendingAction) => {
    if (action.kind === 'queue') {
      socket.emit('queue:join')
    } else if (action.kind === 'create') {
      socket.emit('invite:create', (res) => {
        if (res.code) dispatch({ type: 'invite-code', code: res.code })
      })
    } else {
      socket.emit('invite:join', { code: action.code }, (res) => {
        if (res.ok) return
        dispatch({ type: 'reset' })
        dispatch({ type: 'error', message: inviteError(res.reason) })
      })
    }
  }, [])

  useEffect(() => {
    const socket = createSocket()
    socketRef.current = socket

    socket.on('connect', () => {
      clearTimeout(wakeTimer.current)
      dispatch({ type: 'conn', phase: 'online' })
      const action = pending.current
      pending.current = null
      if (action) runAction(socket, action)
    })
    socket.on('disconnect', () => dispatch({ type: 'conn', phase: 'offline' }))
    socket.io.on('reconnect_attempt', () => dispatch({ type: 'conn', phase: 'waking' }))

    socket.on('game:start', (snapshot) => dispatch({ type: 'start', snapshot }))
    socket.on('state', ({ state: s, lastMove }) => dispatch({ type: 'state', state: s, lastMove }))
    socket.on('invite:waiting', ({ code }) => dispatch({ type: 'invite-code', code }))
    socket.on('game:over', (result) => dispatch({ type: 'over', result }))
    socket.on('error:msg', ({ message }) => dispatch({ type: 'error', message }))

    return () => {
      clearTimeout(wakeTimer.current)
      socket.removeAllListeners()
      socket.io.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [runAction])

  // Connect (if needed) and run `action`, arming the cold-start "waking" hint.
  const dispatchAction = useCallback(
    (action: PendingAction) => {
      const socket = socketRef.current
      if (!socket) return
      wakeTimer.current = setTimeout(() => dispatch({ type: 'conn', phase: 'waking' }), 1500)
      if (socket.connected) {
        clearTimeout(wakeTimer.current)
        runAction(socket, action)
      } else {
        pending.current = action
        socket.connect()
      }
    },
    [runAction],
  )

  const play = useCallback(() => {
    dispatch({ type: 'start-queue' })
    dispatchAction({ kind: 'queue' })
  }, [dispatchAction])

  const createInvite = useCallback(() => {
    dispatch({ type: 'start-invite' })
    dispatchAction({ kind: 'create' })
  }, [dispatchAction])

  const joinInvite = useCallback(
    (code: string) => {
      dispatch({ type: 'start-queue' })
      dispatchAction({ kind: 'join', code })
    },
    [dispatchAction],
  )

  const cancel = useCallback(() => {
    const socket = socketRef.current
    pending.current = null
    clearTimeout(wakeTimer.current)
    socket?.emit('queue:leave')
    socket?.emit('invite:cancel', { code: state.inviteCode ?? '' })
    socket?.disconnect()
    dispatch({ type: 'reset' })
  }, [state.inviteCode])

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

  return {
    ...state,
    play,
    createInvite,
    joinInvite,
    cancel,
    sendMove,
    resign,
    newGame,
    dismissError,
  }
}
