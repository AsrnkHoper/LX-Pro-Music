/**
 * PCM → WAV / MP3 编码
 * WAV: 自实现 RIFF 封装(零依赖)
 * MP3: @breezystack/lamejs(纯 JS LAME 移植,RN 可用)
 */
import type { RenderResult } from './synth'

const SAMPLE_RATE = 44100

/**
 * 编码为 WAV(PCM16 立体声)
 */
export const encodeWav = ({ left, right, length }: RenderResult): Uint8Array => {
  const dataSize = length * 4
  const buf = new Uint8Array(44 + dataSize)
  const view = new DataView(buf.buffer)
  const wstr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  wstr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  wstr(8, 'WAVE')
  wstr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 2, true) // 立体声
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 4, true)
  view.setUint16(32, 4, true)
  view.setUint16(34, 16, true)
  wstr(36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < length; i++) {
    let v = left[i]
    if (v < -1) v = -1
    else if (v > 1) v = 1
    view.setInt16(offset, Math.round(v * 32767), true)
    v = right[i]
    if (v < -1) v = -1
    else if (v > 1) v = 1
    view.setInt16(offset + 2, Math.round(v * 32767), true)
    offset += 4
  }
  return buf
}

/**
 * 编码为 MP3(128kbps,立体声)
 * @param onProgress 进度回调(0-1)
 */
export const encodeMp3 = async (
  { left, right, length }: RenderResult,
  onProgress?: (progress: number) => void
): Promise<Uint8Array> => {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const left16 = new Int16Array(length)
  const right16 = new Int16Array(length)
  for (let i = 0; i < length; i++) {
    left16[i] = Math.max(-1, Math.min(1, left[i])) * 32767
    right16[i] = Math.max(-1, Math.min(1, right[i])) * 32767
  }
  const encoder = new Mp3Encoder(2, SAMPLE_RATE, 128)
  const chunks: Uint8Array[] = []
  let total = 0
  const CHUNK = 1152
  for (let i = 0; i < length; i += CHUNK) {
    const end = Math.min(i + CHUNK, length)
    const chunk = encoder.encodeBuffer(left16.subarray(i, end), right16.subarray(i, end))
    if (chunk.length) {
      chunks.push(chunk)
      total += chunk.length
    }
    onProgress?.(Math.min(1, (i + CHUNK) / length))
  }
  const last = encoder.flush()
  if (last.length) {
    chunks.push(last)
    total += last.length
  }
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  onProgress?.(1)
  return result
}