import { applicationDefault, cert, getApps, initializeApp, type Credential } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

/** Identity derived from a verified Firebase ID token. */
export interface AuthedUser {
  uid: string
  name: string
}

/**
 * Build admin credentials from the environment. Supports either:
 *  - FIREBASE_SERVICE_ACCOUNT — the service-account JSON inline, or base64 of it.
 *  - GOOGLE_APPLICATION_CREDENTIALS — path to a service-account JSON (Google ADC).
 *  - Cloud Run / GCP runtime — the attached service account via the metadata
 *    server (detected by K_SERVICE), so no key file is needed in production.
 * Auth is mandatory: if none of these are present we throw at boot rather than run open.
 */
function loadCredential(): Credential {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (raw) {
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    return cert(JSON.parse(json))
  }
  // On Cloud Run, K_SERVICE is set and applicationDefault() resolves the runtime
  // service account from the metadata server — no GOOGLE_APPLICATION_CREDENTIALS file.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE) return applicationDefault()
  throw new Error(
    'Firebase Admin credentials missing. Set FIREBASE_SERVICE_ACCOUNT (JSON or base64) ' +
      'or GOOGLE_APPLICATION_CREDENTIALS (path to the service-account JSON).',
  )
}

/** Initialise the Admin SDK once. Call at boot so misconfiguration fails fast. */
export function initAuth(): void {
  if (getApps().length === 0) initializeApp({ credential: loadCredential() })
}

/** Stable, friendly fallback name for users with no profile name (anonymous guests). */
function guestName(uid: string): string {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return `Guest-${1000 + (h % 9000)}`
}

/** Verify a Firebase ID token and resolve the player's identity. Throws if invalid. */
export async function verifyToken(token: string): Promise<AuthedUser> {
  const decoded = await getAuth().verifyIdToken(token)
  const name = decoded.name?.trim() || guestName(decoded.uid)
  return { uid: decoded.uid, name }
}
