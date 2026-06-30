import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getIdToken,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { firebaseAuth, googleProvider } from './firebase'

export interface AuthValue {
  user: User | null
  /** True until the first auth state resolves, so we don't flash the login screen. */
  loading: boolean
  /** True when the signed-in user is an anonymous guest (eligible for linking). */
  isGuest: boolean
  signInGoogle: () => Promise<void>
  signInEmail: (email: string, password: string) => Promise<void>
  registerEmail: (email: string, password: string) => Promise<void>
  signInGuest: () => Promise<void>
  /** Upgrade the current anonymous guest to a permanent Google account. */
  linkGoogle: () => Promise<void>
  /** Upgrade the current anonymous guest to a permanent email/password account. */
  linkEmail: (email: string, password: string) => Promise<void>
  /** Change the display name of a permanent (non-guest) account. */
  setDisplayName: (name: string) => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

/** Turn Firebase error codes into something a player can read. */
function describe(err: unknown): string {
  const code = (err as { code?: string }).code ?? ''
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.'
    case 'auth/missing-password':
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/email-already-in-use':
      return 'An account with that email already exists — sign in instead.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.'
    case 'auth/credential-already-in-use':
      return 'That account is already linked to another login.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

/** Wrap a Firebase call so callers get a friendly Error instead of a raw code. */
async function attempt(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    throw new Error(describe(err))
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const requireGuest = (): User => {
    const u = firebaseAuth.currentUser
    if (!u || !u.isAnonymous) throw new Error('No guest account to upgrade.')
    return u
  }

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      isGuest: !!user?.isAnonymous,
      signInGoogle: () => attempt(() => signInWithPopup(firebaseAuth, googleProvider)),
      signInEmail: (email, password) =>
        attempt(() => signInWithEmailAndPassword(firebaseAuth, email, password)),
      registerEmail: (email, password) =>
        attempt(() => createUserWithEmailAndPassword(firebaseAuth, email, password)),
      signInGuest: () => attempt(() => signInAnonymously(firebaseAuth)),
      linkGoogle: () => attempt(() => linkWithPopup(requireGuest(), googleProvider)),
      linkEmail: (email, password) =>
        attempt(() =>
          linkWithCredential(requireGuest(), EmailAuthProvider.credential(email, password)),
        ),
      setDisplayName: async (name) => {
        const u = firebaseAuth.currentUser
        if (!u || u.isAnonymous) throw new Error('Sign in to set a display name.')
        const trimmed = name.trim()
        if (trimmed.length < 2 || trimmed.length > 24) {
          throw new Error('Display name must be 2–24 characters.')
        }
        try {
          await updateProfile(u, { displayName: trimmed })
          // The token's `name` claim is set at mint time; refresh so the server sees it.
          await getIdToken(u, true)
        } catch (err) {
          throw new Error(describe(err))
        }
        // Surface the change to React (updateProfile mutates in place, no auth event).
        setUser({ ...u } as User)
      },
      signOutUser: () => attempt(() => signOut(firebaseAuth)),
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
