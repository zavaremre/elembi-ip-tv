import { useEffect, useState } from 'react'
import type { Match } from '@shared/types'

/** Badge URLs for the team names parsed out of the EPG, keyed by the name itself. */
export function useTeamBadges(matches: Match[]): Map<string, string> {
  const [badges, setBadges] = useState<Map<string, string>>(new Map())
  const names = [...new Set(matches.flatMap((match) => [match.home, match.away]))].sort().join('|')

  useEffect(() => {
    if (!names) return
    let alive = true
    window.akis.teams
      .badges(names.split('|'))
      .then((result) => {
        if (!alive) return
        const next = new Map<string, string>()
        for (const [name, url] of Object.entries(result)) if (url) next.set(name, url)
        setBadges(next)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [names])

  return badges
}
