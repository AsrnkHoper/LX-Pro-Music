/**
 * MIDI 合成结果缓存
 * 缓存键 = md5(文件路径 + 最后修改时间),避免文件内容变化后仍用旧缓存
 */
import { privateStorageDirectoryPath, mkdir, existsFile, readDir, unlink } from '@/utils/fs'
import { stringMd5 } from 'react-native-quick-md5'

let cacheDir: string | null = null

/** MIDI 缓存目录(私有目录下,应用卸载即清) */
export const getMidiCacheDir = () => {
  if (cacheDir) return cacheDir
  cacheDir = `${privateStorageDirectoryPath}/midi`
  return cacheDir
}

const extOf = (isMp3: boolean) => (isMp3 ? 'mp3' : 'wav')

/**
 * 计算缓存文件路径(不含扩展名,调用方决定格式)
 * 文件名: midi_<md5>.mp3 / midi_<md5>.wav
 */
export const getCacheKey = (filePath: string, lastModified: number) =>
  stringMd5(`${filePath}_${lastModified}_${getMidiCacheDir()}`)

export const getCacheFilePath = (filePath: string, lastModified: number, isMp3: boolean) =>
  `${getMidiCacheDir()}/midi_${getCacheKey(filePath, lastModified)}.${extOf(isMp3)}`

/** 检查缓存是否存在(mp3 优先,wav 兜底),返回存在的路径 */
export const getCachedPath = async (filePath: string, lastModified: number): Promise<string | null> => {
  const mp3 = getCacheFilePath(filePath, lastModified, true)
  if (await existsFile(mp3)) return mp3
  const wav = getCacheFilePath(filePath, lastModified, false)
  if (await existsFile(wav)) return wav
  return null
}

/** 确保缓存目录存在 */
export const ensureCacheDir = async () => {
  const dir = getMidiCacheDir()
  if (!(await existsFile(dir))) await mkdir(dir)
}

const MAX_CACHE_FILES = 30

/** 清理超出上限的旧缓存(保留最近的文件) */
export const cleanCache = async (keepPath?: string) => {
  try {
    const dir = getMidiCacheDir()
    if (!(await existsFile(dir))) return
    const files = (await readDir(dir)).filter(
      (f) => !f.isDirectory && /^midi_.+\.(mp3|wav)$/.test(f.name)
    )
    if (files.length <= MAX_CACHE_FILES) return
    const sorted = files.sort((a, b) => b.lastModified - a.lastModified)
    for (const file of sorted.slice(MAX_CACHE_FILES)) {
      if (keepPath && file.path === keepPath) continue
      await unlink(file.path).catch(() => {})
    }
  } catch (err) {
    console.log('midi cache clean failed', err)
  }
}