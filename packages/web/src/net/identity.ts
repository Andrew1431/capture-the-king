const KEY = 'ctk.guest'

export interface Guest {
  uid: string
  name: string
}

/** Load (or lazily create + persist) this browser's guest identity. */
export function loadGuest(): Guest {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Guest
  } catch {
    // ignore malformed storage; fall through to a fresh guest
  }
  const guest: Guest = {
    uid: `guest-${crypto.randomUUID()}`,
    name: `Guest-${Math.floor(1000 + Math.random() * 9000)}`,
  }
  localStorage.setItem(KEY, JSON.stringify(guest))
  return guest
}
