import { fullTimeToMs, msToLrcTime } from './time'

const cueRe = /(\d{1,}:\d{2}:\d{2}\.\d{1,3})\s*-->\s*(\d{1,}:\d{2}:\d{2}\.\d{1,3})/

export const parseVTT = (content: string): LX.Music.LyricInfo => {
  let text = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  if (/^WEBVTT/i.test(text)) {
    const headerEnd = text.indexOf('\n\n')
    if (headerEnd !== -1) text = text.slice(headerEnd + 2)
  }

  const blocks = text.split(/\n[ \t]*\n/)
  const lines: string[] = []

  for (const block of blocks) {
    const linesOfBlock = block.split('\n').filter((l) => l.trim() !== '')
    let timeLineIdx = linesOfBlock.findIndex((l) => cueRe.test(l))
    if (timeLineIdx === -1) continue

    const timeMatch = linesOfBlock[timeLineIdx].match(cueRe)
    if (!timeMatch) continue

    const startMs = fullTimeToMs(timeMatch[1])
    const cueText = linesOfBlock.slice(timeLineIdx + 1).join(' ').trim()
    if (!cueText) continue

    const cleaned = cueText.replace(/\{[^}]*\}/g, '').replace(/<[^>]+>/g, '').trim()
    if (!cleaned) continue

    lines.push(`[${msToLrcTime(startMs)}]${cleaned}`)
  }

  return { lyric: lines.join('\n') }
}
