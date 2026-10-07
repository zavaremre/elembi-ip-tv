import { useEffect, useMemo, useState } from 'react'
import type { Match } from '@shared/types'

const DUE_WINDOW_MS = 15 * 60_000
const TICK_MS = 30_000

export interface Reminders {
  ids: Set<string>
  toggle: (match: Match) => void
  has: (match: Match) => boolean
  due: Match | null
  dismiss: () => void
}

const keyOf = (match: Match): string => `${match.channelId}:${match.start}`

/** Reminder set for upcoming fixtures, plus the one that is about to start. */
export function useReminders(matches: Match[]): Reminders {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(timer)
  }, [])

  const due = useMemo(() => {
    const upcoming = matches.filter((m) => {
      const k = keyOf(m)
      return ids.has(k) && !dismissed.has(k) && m.start - now <= DUE_WINDOW_MS && m.stop > now
    })
    return upcoming[0] ?? null
  }, [matches, ids, dismissed, now])

  return {
    ids,
    has: (match) => ids.has(keyOf(match)),
    toggle: (match) =>
      setIds((prev) => {
        const next = new Set(prev)
        const k = keyOf(match)
        if (next.has(k)) next.delete(k)
        else next.add(k)
        return next
      }),
    due,
    dismiss: () => {
      if (due) setDismissed((prev) => new Set(prev).add(keyOf(due)))
    }
  }
}
