import { lrcTimeToMs, msToLrcTime } from './time'

const lrcTimeTag = /\[(\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?)\]/g

export const parseLrcCompatible = (content: string): LX.Music.LyricInfo => {
  const text = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  if (/<\d+,\d+(?:,\d+)?>/.test(text)) {
    let lxlyric = text.replace(/<(\d+,\d+),\d+>/g, '<$1>')
    lxlyric = lxlyric.replace(lrcTimeTag, (_tag, t) => `[${msToLrcTime(lrcTimeToMs(t))}]`)
    const lyric = lxlyric.replace(/<\d+,\d+>/g, '')
    return { lyric, lxlyric }
  }

  const normalized = text.replace(lrcTimeTag, (_tag, t) => `[${msToLrcTime(lrcTimeToMs(t))}]`)
  return { lyric: normalized }
}
