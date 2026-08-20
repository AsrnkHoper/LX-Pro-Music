import { extname, existsFile, readFile } from '@/utils/fs'
import { parseLrcCompatible } from './lrcLike'
import { parseSRT } from './srt'
import { parseVTT } from './vtt'

const LYRIC_EXTENSIONS = ['lrc', 'esl', 'srt', 'vtt']

const lowerExt = (name: string) => extname(name).toLowerCase()

export const findSiblingLyricFile = async (audioFilePath: string): Promise<string | null> => {
  const lastDot = audioFilePath.lastIndexOf('.')
  const lastSlash = Math.max(audioFilePath.lastIndexOf('/'), audioFilePath.lastIndexOf('\\'))
  if (lastDot <= lastSlash) return null
  const base = audioFilePath.slice(0, lastDot)

  for (const ext of LYRIC_EXTENSIONS) {
    const candidate = `${base}.${ext}`
    if (await existsFile(candidate).catch(() => false)) return candidate
  }
  return null
}

export const parseLyricFile = async (filePath: string): Promise<LX.Music.LyricInfo | null> => {
  const ext = lowerExt(filePath)
  const content = await readFile(filePath).catch(() => null)
  if (!content) return null

  switch (ext) {
    case 'lrc':
    case 'esl':
      return parseLrcCompatible(content)
    case 'srt':
      return parseSRT(content)
    case 'vtt':
      return parseVTT(content)
    default:
      return null
  }
}
