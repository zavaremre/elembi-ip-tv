import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Progress, SubtitleSync } from '../shared/types'

interface Shape {
  progress: Progress[]
  favorites: number[]
  /**
   * Subtitle offset per title, for files loaded from disk. Worth keeping rather
   * than making the viewer find the same value again on every episode.
   */
  subtitleSync: Record<string, SubtitleSync>
}

const file = (): string => join(app.getPath('userData'), 'state.json')
let state: Shape | null = null

function read(): Shape {
  if (state) return state
  state = existsSync(file())
    ? (JSON.parse(readFileSync(file(), 'utf8')) as Shape)
    : { progress: [], favorites: [], subtitleSync: {} }
  state.progress ??= []
  state.favorites ??= []
  state.subtitleSync ??= {}
  return state
}

function write(): void {
  if (state) writeFileSync(file(), JSON.stringify(state, null, 2))
}

export const store = {
  progress(): Progress[] {
    return read()
      .progress.filter((p) => p.duration > 0 && p.position / p.duration < 0.96)
      .sort((a, b) => b.updated - a.updated)
      .slice(0, 20)
  },
  saveProgress(p: Omit<Progress, 'updated'>): Progress[] {
    const s = read()
    const i = s.progress.findIndex((x) => x.key === p.key)
    const row: Progress = { ...p, updated: Date.now() }
    if (i >= 0) s.progress[i] = row
    else s.progress.unshift(row)
    s.progress = s.progress.slice(0, 60)
    write()
    return this.progress()
  },
  subtitleSync(key: string): SubtitleSync {
    return read().subtitleSync[key] ?? { delay: 0 }
  },
  saveSubtitleSync(key: string, sync: SubtitleSync): void {
    const s = read()
    /* A title back at zero is dropped rather than stored as a no-op. */
    if (sync.delay === 0) delete s.subtitleSync[key]
    else s.subtitleSync[key] = { delay: sync.delay }
    write()
  },
  favorites(): number[] {
    return read().favorites
  },
  toggleFavorite(id: number): number[] {
    const s = read()
    const i = s.favorites.indexOf(id)
    if (i >= 0) s.favorites.splice(i, 1)
    else s.favorites.push(id)
    write()
    return s.favorites
  }
}
