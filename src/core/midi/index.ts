/**
 * MIDI 演奏核心编排
 * 链路: .mid 文件 → 解析 → 合成 PCM → 编码 MP3(失败降级 WAV) → 落盘缓存 → 返回 file:// 播放路径
 * 播放仍走现有 TrackPlayer 链路,进度/切歌/通知栏全部复用
 */
import type { FileType } from '@/utils/fs'
import { stat, writeFile } from '@/utils/fs'
import { setStatusText } from '@/core/player/playStatus'
import { formatPlayTime2 } from '@/utils/common'
import { parseMidiFile } from './parse'
import { renderPcm } from './synth'
import { encodeWav, encodeMp3 } from './encode'
import { ensureCacheDir, getCachedPath, getCacheFilePath, getCacheKey, cleanCache } from './cache'

/** 判断是否为 MIDI 音乐信息(通过 meta.ext 识别) */
export const isMidiMusic = (musicInfo: { meta: { ext?: string } }) => {
  const ext = musicInfo.meta.ext?.toLowerCase()
  return ext === 'mid' || ext === 'midi'
}

let lastProgress = -1

const updateSynthProgress = (progress: number, isWav = false) => {
  const percent = Math.floor(progress * 100)
  if (percent === lastProgress) return
  lastProgress = percent
  const key = isWav ? 'midi_synthesizing_wav' : 'midi_synthesizing'
  setStatusText(global.i18n.t(key, { percent }))
}

const resetProgress = () => {
  lastProgress = -1
}

/**
 * 构造 MIDI 音乐信息(复用 local 源结构,meta.ext 标记为 mid/midi)
 * @throws 文件不是合法 MIDI 时抛错
 */
export const buildMidiMusicInfo = async (file: FileType): Promise<LX.Music.MusicInfoLocal> => {
  const parsed = await parseMidiFile(file.path)
  const index = file.name.lastIndexOf('.')
  return {
    id: file.path,
    name: file.name.substring(0, index),
    singer: '',
    source: 'local',
    interval: formatPlayTime2(parsed.duration),
    meta: {
      albumName: '',
      filePath: file.path,
      songId: file.path,
      picUrl: '',
      ext: file.name.substring(index + 1).toLowerCase(),
    },
  }
}

/**
 * 获取 MIDI 播放 URL:优先缓存,否则实时合成
 * 返回 file:// 开头的本地音频文件路径
 */
export const getMidiMusicUrl = async (musicInfo: LX.Music.MusicInfoLocal): Promise<string> => {
  const filePath = musicInfo.meta.filePath
  const fileInfo = await stat(filePath)
  const lastModified = fileInfo.lastModified

  // 1. 缓存命中直接返回
  const cachedPath = await getCachedPath(filePath, lastModified)
  if (cachedPath) return `file://${cachedPath}`

  // 2. 实时合成
  resetProgress()
  setStatusText(global.i18n.t('midi_synthesizing', { percent: 0 }))
  cleanCache().catch(() => {})
  try {
    const parsed = await parseMidiFile(filePath)
    updateSynthProgress(0.05)
    const pcm = renderPcm(parsed, (p) => updateSynthProgress(0.05 + p * 0.75))

    // 3. 编码:优先 MP3,失败降级 WAV
    let data: Uint8Array
    let isMp3 = true
    try {
      data = await encodeMp3(pcm, (p) => updateSynthProgress(0.8 + p * 0.2))
    } catch (err) {
      console.log('midi mp3 encode failed, fallback to wav', err)
      isMp3 = false
      data = encodeWav(pcm)
      updateSynthProgress(1, true)
    }

    // 4. 落盘缓存
    await ensureCacheDir()
    const cachePath = getCacheFilePath(filePath, lastModified, isMp3)
    const base64 = Buffer.from(data).toString('base64')
    await writeFile(cachePath, base64, 'base64')

    resetProgress()
    cleanCache(cachePath).catch(() => {})
    return `file://${cachePath}`
  } catch (err: any) {
    resetProgress()
    throw new Error(global.i18n.t('midi_synth_error', { message: err?.message ?? String(err) }))
  }
}

/** 提前预热缓存(可选,用于扫描本地库时后台合成) */
export const prewarmMidiCache = async (filePath: string) => {
  const fileInfo = await stat(filePath)
  const cached = await getCachedPath(filePath, fileInfo.lastModified)
  if (cached) return false
  const parsed = await parseMidiFile(filePath)
  const pcm = renderPcm(parsed)
  await ensureCacheDir()
  try {
    const data = await encodeMp3(pcm)
    const cachePath = getCacheFilePath(filePath, fileInfo.lastModified, true)
    await writeFile(cachePath, Buffer.from(data).toString('base64'), 'base64')
    return true
  } catch (err) {
    console.log('midi prewarm mp3 failed', err)
    const data = encodeWav(pcm)
    const cachePath = getCacheFilePath(filePath, fileInfo.lastModified, false)
    await writeFile(cachePath, Buffer.from(data).toString('base64'), 'base64')
    return true
  }
}

/** 合成结果缓存键(供外部排查/清理时引用) */
export { getCacheKey } from './cache'