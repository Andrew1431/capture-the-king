import { getAnalytics, isSupported, logEvent, type Analytics } from 'firebase/analytics'
import { app } from './auth/firebase'

// Lazily resolve a single Analytics instance. Returns null when analytics is
// unsupported (e.g. no IndexedDB) or no measurementId is configured (dev), so
// callers can fire events unconditionally without guarding.
let instance: Promise<Analytics | null> | null = null

function analytics(): Promise<Analytics | null> {
  if (!instance) {
    instance = isSupported()
      .then((ok) => (ok && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ? getAnalytics(app) : null))
      .catch(() => null)
  }
  return instance
}

/**
 * Initialize Firebase Analytics. GA4 auto-collects page_view, session_start,
 * first_visit, user_engagement, etc. once the instance exists — call this once
 * at startup.
 */
export function initAnalytics(): void {
  void analytics()
}

/** Log a custom event. No-ops when analytics is unavailable. */
export function track(event: string, params?: Record<string, unknown>): void {
  void analytics().then((a) => {
    if (a) logEvent(a, event, params)
  })
}
