import { dialog } from 'electron'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { SubtitleFile } from '../shared/types'
import { t } from './i18n'

/**
 * Turkish subtitle files are still commonly shipped as windows-1254, so UTF-8 is
 * tried first and a legacy decode is used when it produces replacement chars.
 */
function decodeSubtitle(buffer: Buffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('�')) return utf8
  try {
    return new TextDecoder('windows-1254').decode(buffer)
  } catch {
    return utf8
  }
}

/** SRT and WebVTT differ only in the header and the millisecond separator. */
export function srtToVtt(text: string): string {
  const body = text
    .replace(/^﻿/, '')
    .replace(/\r/g, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim()
  return body.startsWith('WEBVTT') ? body : `WEBVTT\n\n${body}`
}

export async function openLocalSubtitle(): Promise<SubtitleFile | null> {
  const result = await dialog.showOpenDialog({
    title: t('subs.pickTitle'),
    filters: [{ name: t('track.subtitleLabel'), extensions: ['srt', 'vtt'] }],
    properties: ['openFile']
  })
  const path = result.filePaths[0]
  if (result.canceled || !path) return null
  const buffer = await readFile(path)
  return { label: basename(path), vtt: srtToVtt(decodeSubtitle(buffer)) }
}
