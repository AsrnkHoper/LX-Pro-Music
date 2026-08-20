/**
 * MIDI 文件解析
 * 基于 @tonejs/midi（纯 JS，无外部依赖）
 */
import { Midi } from '@tonejs/midi'
import { readFile } from '@/utils/fs'

export interface MidiNote {
  /** MIDI 音符号(0-127)，60 = 中央C */
  midi: number
  /** 开始时间(秒) */
  time: number
  /** 持续时长(秒) */
  duration: number
  /** 力度(0-1) */
  velocity: number
  /** 通道号(0-15) */
  channel: number
}

export interface ParsedMidi {
  /** 总时长(秒) */
  duration: number
  /** 初始速度(BPM) */
  bpm: number
  notes: MidiNote[]
  /** 各通道的乐器号(GM program)，key 为通道号 */
  programs: Record<number, number>
  /** 是否包含打击乐通道(第10通道) */
  hasDrums: boolean
}

/**
 * 解析 MIDI 文件
 * @param filePath MIDI 文件路径
 */
export const parseMidiFile = async (filePath: string): Promise<ParsedMidi> => {
  const base64 = await readFile(filePath, 'base64')
  const data = Buffer.from(base64, 'base64')
  const midi = new Midi(data)

  const notes: MidiNote[] = []
  const programs: Record<number, number> = {}
  let hasDrums = false
  for (const track of midi.tracks) {
    if (track.instrument.percussion) hasDrums = true
    if (programs[track.channel] == undefined) programs[track.channel] = track.instrument.number
    for (const note of track.notes) {
      notes.push({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
        channel: track.channel,
      })
    }
  }

  return {
    duration: midi.duration,
    bpm: midi.header.tempos[0]?.bpm ?? 120,
    notes,
    programs,
    hasDrums,
  }
}