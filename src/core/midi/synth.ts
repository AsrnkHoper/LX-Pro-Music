/**
 * 纯 JS 软件合成器
 * 将解析后的 MIDI 音符渲染为 PCM(44100Hz 立体声 Float32Array)
 * 采用波表(wavetable)合成:每个音色预计算一个周期的谐波叠加表,按频率相位增量播放
 */
import type { ParsedMidi, MidiNote } from './parse'

const SR = 44100
const TABLE_SIZE = 4096
const MAX_DRUM_TIME = 2

type Timbre = 'piano' | 'organ' | 'bass' | 'strings' | 'guitar' | 'brass' | 'default'

/** GM 乐器号 → 音色族 */
const timbreOf = (program: number): Timbre => {
  if (program < 8) return 'piano'
  if (program < 16) return 'default'
  if (program < 24) return 'organ'
  if (program < 32) return 'guitar'
  if (program < 40) return 'bass'
  if (program < 56) return 'strings'
  if (program < 64) return 'brass'
  if (program < 80) return 'default'
  if (program < 96) return 'strings'
  return 'default'
}

interface TimbreConfig {
  harmonics: number[] // 各谐波振幅
  attack: number // 起音时间(秒)
  decay: number // 衰减时间常数(秒),越大越绵长
  gain: number // 音量系数
  bright: number // 泛音亮度提升(作用于高频谐波)
}

const TIMBRES: Record<Timbre, TimbreConfig> = {
  piano: { harmonics: [1, 0.5, 0.25, 0.12, 0.06], attack: 0.004, decay: 0.55, gain: 0.22, bright: 0 },
  organ: { harmonics: [1, 0.6, 0.4, 0.22, 0.1], attack: 0.02, decay: 1.8, gain: 0.16, bright: 0 },
  bass: { harmonics: [1, 0.35, 0.15, 0.07], attack: 0.005, decay: 0.5, gain: 0.28, bright: 0 },
  strings: { harmonics: [1, 0.58, 0.42, 0.3, 0.2], attack: 0.3, decay: 0.9, gain: 0.12, bright: 0.4 },
  guitar: { harmonics: [1, 0.4, 0.18, 0.08], attack: 0.002, decay: 0.4, gain: 0.2, bright: 0.15 },
  brass: { harmonics: [1, 0.7, 0.35, 0.15], attack: 0.08, decay: 0.5, gain: 0.15, bright: 0.25 },
  default: { harmonics: [1, 0.5, 0.25, 0.12], attack: 0.01, decay: 0.6, gain: 0.18, bright: 0 },
}

/** 预计算波表(每个音色一个周期表,含 2π 相位提前,避免起点爆音) */
const buildTables = (): Record<Timbre, Float32Array> => {
  const result = {} as Record<Timbre, Float32Array>
  for (const key of Object.keys(TIMBRES) as Timbre[]) {
    const conf = TIMBRES[key]
    const table = new Float32Array(TABLE_SIZE)
    const harmonics = conf.harmonics
    const total = harmonics[0]
    for (let h = 1; h < harmonics.length; h++) {
      const amp = harmonics[h] * (1 + conf.bright * (h - 1))
      const phase = (h % 2 === 0 ? 1 : 0.5) * 2
      for (let i = 0; i < TABLE_SIZE; i++) {
        table[i] += amp * Math.sin((2 * Math.PI * h * i) / TABLE_SIZE + phase)
      }
    }
    // 归一化到 -1~1
    let peak = 0
    for (let i = 0; i < TABLE_SIZE; i++) peak = Math.max(peak, Math.abs(table[i]))
    const norm = peak > 0 ? 1 / peak : 1
    for (let i = 0; i < TABLE_SIZE; i++) table[i] *= norm
    result[key] = table
  }
  return result
}

const TABLES = buildTables()

const freqOf = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** 播放单个音符到缓冲区 */
const renderNote = (
  left: Float32Array,
  right: Float32Array,
  table: Float32Array,
  startSample: number,
  note: MidiNote,
  timbre: Timbre
) => {
  const config = TIMBRES[timbre]
  const f = freqOf(note.midi)
  const gain = config.gain * Math.max(0.05, note.velocity)
  const attackSamples = Math.max(1, Math.floor(config.attack * SR))
  // 释放:音符结束后 0.1s 衰减
  const releaseSamples = Math.floor(0.1 * SR)
  const totalSamples = Math.floor(note.duration * SR) + releaseSamples
  const end = Math.min(startSample + totalSamples, left.length)
  if (startSample >= end) return
  const phaseInc = (f * TABLE_SIZE) / SR
  let phase = 0
  const decayLambda = 6 / (Math.max(0.05, config.decay) * SR)
  // 立体声:按通道轻微左右偏置,通道偶数偏左
  const panL = note.channel % 2 === 0 ? 1 : 0.86
  const panR = note.channel % 2 === 0 ? 0.86 : 1
  let i = startSample
  let local = 0
  while (i < end) {
    const env =
      local < attackSamples
        ? local / attackSamples
        : Math.exp(-(local - attackSamples) * decayLambda)
    const s = table[phase | 0] * env * gain
    left[i] += s * panL
    right[i] += s * panR
    phase += phaseInc
    if (phase >= TABLE_SIZE) phase -= TABLE_SIZE
    i++
    local++
  }
}

/** 共享噪声缓冲(打击乐) */
let noiseBuf: Float32Array | null = null
const getNoise = () => {
  if (noiseBuf) return noiseBuf
  noiseBuf = new Float32Array(SR * MAX_DRUM_TIME)
  for (let i = 0; i < noiseBuf.length; i++) noiseBuf[i] = Math.random() * 2 - 1
  return noiseBuf
}

/** 渲染打击乐(GM 鼓组,通道 9) */
const renderDrum = (left: Float32Array, right: Float32Array, startSample: number, note: MidiNote) => {
  const n = note.midi
  if (startSample >= left.length) return
  const noise = getNoise()
  const vel = Math.max(0.05, note.velocity)
  switch (true) {
    case n === 35 || n === 36: {
      // 底鼓:频率下扫的正弦
      const dur = Math.floor(0.35 * SR)
      const end = Math.min(startSample + dur, left.length)
      const f0 = n === 35 ? 110 : 130
      let i = startSample
      let t = 0
      while (i < end) {
        const f = f0 * Math.exp(-5 * t)
        const phase = (2 * Math.PI * f0 * (1 - Math.exp(-5 * t))) / 5
        const env = Math.exp(-3 * t)
        const s = Math.sin(phase) * env * 0.5 * vel
        left[i] += s
        right[i] += s
        i++
        t += 1 / SR
      }
      break
    }
    case n === 37 || n === 38 || n === 40: {
      // 军鼓:噪声 + 中频音
      const dur = Math.floor(0.18 * SR)
      const end = Math.min(startSample + dur, left.length)
      let i = startSample
      let t = 0
      while (i < end) {
        const env = Math.exp(-12 * t)
        const s = (0.6 * noise[i % noise.length] + 0.4 * Math.sin(2 * Math.PI * 190 * t)) * env * 0.4 * vel
        left[i] += s
        right[i] += s
        i++
        t += 1 / SR
      }
      break
    }
    case n === 42 || n === 44 || n === 46 || n === 54: {
      // 踩镲/拍手盘:短促高频噪声
      const dur = Math.floor(0.09 * SR)
      const end = Math.min(startSample + dur, left.length)
      let i = startSample
      let t = 0
      while (i < end) {
        const env = Math.exp(-35 * t)
        const s = noise[i % noise.length] * env * 0.25 * vel
        left[i] += s
        right[i] += s
        i++
        t += 1 / SR
      }
      break
    }
    case n === 39:
    case n === 41:
    case n === 43:
    case n === 45:
    case n === 47:
    case n === 48:
    case n === 50: {
      // 通鼓/拍手:衰减音高正弦
      const f = 100 * Math.pow(2, (n - 45) / 7)
      const dur = Math.floor(0.3 * SR)
      const end = Math.min(startSample + dur, left.length)
      let i = startSample
      let t = 0
      while (i < end) {
        const env = Math.exp(-7 * t)
        const s = Math.sin(2 * Math.PI * f * t) * env * 0.4 * vel
        left[i] += s
        right[i] += s
        i++
        t += 1 / SR
      }
      break
    }
    default: {
      // 其他(擦片等):长噪声
      const dur = Math.floor(0.5 * SR)
      const end = Math.min(startSample + dur, left.length)
      let i = startSample
      let t = 0
      while (i < end) {
        const env = Math.exp(-6 * t)
        const s = noise[i % noise.length] * env * 0.2 * vel
        left[i] += s
        right[i] += s
        i++
        t += 1 / SR
      }
      break
    }
  }
}

export interface RenderResult {
  left: Float32Array
  right: Float32Array
  /** 实际渲染的采样数 */
  length: number
}

/**
 * 渲染 MIDI 为 PCM
 * @param onProgress 进度回调(0-1)
 */
export const renderPcm = (
  parsed: ParsedMidi,
  onProgress?: (progress: number) => void
): RenderResult => {
  const totalSamples = Math.ceil(parsed.duration * SR) + Math.floor(0.5 * SR)
  const left = new Float32Array(totalSamples)
  const right = new Float32Array(totalSamples)

  // 音符按开始时间排序,按窗口分批渲染(避免生成时 GC 压力)
  const notes = [...parsed.notes].sort((a, b) => a.time - b.time)
  const drumNotes: MidiNote[] = []
  const melodicNotes: MidiNote[] = []
  for (const note of notes) {
    if (note.channel === 9) drumNotes.push(note)
    else melodicNotes.push(note)
  }

  // 渲染旋律(含鼓的备用音色映射)
  for (const note of melodicNotes) {
    const timbre = timbreOf(parsed.programs[note.channel] ?? 0)
    renderNote(left, right, TABLES[timbre], Math.floor(note.time * SR), note, timbre)
  }
  for (const note of drumNotes) {
    renderDrum(left, right, Math.floor(note.time * SR), note)
  }

  // 归一化 + 软限幅
  let peak = 0
  for (let i = 0; i < totalSamples; i++) {
    const l = left[i]
    const r = right[i]
    const a = l < 0 ? -l : l
    const b = r < 0 ? -r : r
    if (a > peak) peak = a
    if (b > peak) peak = b
  }
  const norm = peak > 0.89 ? 0.89 / peak : 1
  // 软限幅:y = tanh(1.5x)/tanh(1.5)
  const limiter = 1 / Math.tanh(1.5)
  for (let i = 0; i < totalSamples; i++) {
    left[i] = Math.tanh(left[i] * norm * 1.5) * limiter
    right[i] = Math.tanh(right[i] * norm * 1.5) * limiter
  }

  onProgress?.(1)
  return { left, right, length: totalSamples }
}