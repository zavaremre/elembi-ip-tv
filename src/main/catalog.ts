import { app } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/*
 * The catalogue is ~12k entries spread over three endpoints and it changes
 * slowly, so each one is kept on disk. Two things come out of that: a restart
 * no longer re-asks the panel for everything, and when the panel cannot be
 * reached the app still opens with the last catalogue it saw. Panels ban
 * addresses that poll them hard, which makes the saved copy the safer default
 * rather than a nicety.
 */
interface Row<T> {
  at: number
  data: T
}

const NAMES = ['channels', 'vod', 'series'] as const
export type CatalogName = (typeof NAMES)[number]

const file = (name: CatalogName): string => join(app.getPath('userData'), `catalog-${name}.json`)

/** True while any catalogue on screen came from disk after a failed refresh. */
let servedStale = false
/**
 * Names whose saved copy should be ignored on the next read.
 *
 * A refresh used to delete the files outright, which defeated the point of
 * keeping them: the copy was gone before anyone knew whether the panel could be
 * reached, so an outage during a refresh left the app empty. Marking instead of
 * deleting means the network is tried and the old copy still answers if it
 * fails.
 */
const expired = new Set<CatalogName>()

function read<T>(name: CatalogName): Row<T> | null {
  try {
    const path = file(name)
    if (!existsSync(path)) return null
    const row = JSON.parse(readFileSync(path, 'utf8')) as Row<T>
    return typeof row?.at === 'number' && row.data !== undefined ? row : null
  } catch {
    /* A corrupt cache is simply no cache. */
    return null
  }
}

/** Fresh copy wins; a refresh that throws falls back to the stale copy. */
export async function catalog<T>(name: CatalogName, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const row = read<T>(name)
  const fresh = row && Date.now() - row.at < ttlMs && !expired.has(name)
  if (fresh) return row.data

  try {
    const data = await load()
    try {
      writeFileSync(file(name), JSON.stringify({ at: Date.now(), data } satisfies Row<T>))
    } catch {
      /* A cache that cannot be written is still a successful fetch. */
    }
    expired.delete(name)
    servedStale = false
    return data
  } catch (error) {
    if (!row) throw error
    servedStale = true
    return row.data
  }
}

export function catalogIsStale(): boolean {
  return servedStale
}

/** Age of the oldest saved catalogue, for telling the user how old the copy is. */
export function catalogSavedAt(): number | null {
  const times = NAMES.map((name) => read<unknown>(name)?.at).filter((at): at is number => typeof at === 'number')
  return times.length ? Math.min(...times) : null
}

/**
 * Forces the next read to go to the panel while leaving the saved copy in place
 * as a fallback. This is what a refresh wants; deleting is not.
 */
export function expireCatalog(): void {
  for (const name of NAMES) expired.add(name)
}

/** Drops the saved copies for good. Only for forgetting a subscription. */
export function clearCatalog(): void {
  servedStale = false
  expired.clear()
  for (const name of NAMES) {
    try {
      rmSync(file(name), { force: true })
    } catch {
      /* Nothing to drop. */
    }
  }
}
