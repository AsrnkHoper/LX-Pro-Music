/**
 * 听歌统计页 · 派生数据处理层
 *
 * 纯函数：接收内存中的 daily / song / events / history 与时间范围，
 * 返回各展示模块所需结构化结果。无 IO、无副作用。
 */
import { toDateText } from './utils'

export type TimeRange = 'week' | 'month' | 'year' | 'all'

export interface StatsPageData {
  daily: LX.Stats.DailyItem[]
  song: LX.Stats.SongItem[]
  events: LX.Stats.EventItem[]
  history: LX.Player.PlayHistoryItem[]
}

const DAY = 24 * 60 * 60 * 1000

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/** 当前范围起点（含） */
export const getRangeStart = (range: TimeRange): number => {
  const now = new Date()
  if (range === 'week') {
    const day = now.getDay()
    const mondayOffset = (day + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - mondayOffset)
    return startOfDay(monday)
  }
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  if (range === 'year') return new Date(now.getFullYear(), 0, 1).getTime()
  return 0
}

/** 当前范围终点（含） */
export const getRangeEnd = (range: TimeRange): number => {
  const now = new Date()
  if (range === 'week') {
    const day = now.getDay()
    const mondayOffset = (day + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - mondayOffset)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return sunday.getTime()
  }
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1
  if (range === 'year') return new Date(now.getFullYear() + 1, 0, 1).getTime() - 1
  return Number.MAX_SAFE_INTEGER
}

const rangeLength = (range: TimeRange): number => getRangeEnd(range) - getRangeStart(range) + 1

/** 上一周期起点（含），用于趋势对比 */
export const getPrevRangeStart = (range: TimeRange): number => {
  const start = getRangeStart(range)
  const length = rangeLength(range)
  return start - length
}

/** 上一周期终点（含） */
export const getPrevRangeEnd = (range: TimeRange): number => {
  const start = getRangeStart(range)
  return start - 1
}

export const filterByRange = <T extends { playedAt: number }>(items: T[], range: TimeRange): T[] => {
  const start = getRangeStart(range)
  const end = getRangeEnd(range)
  return items.filter(item => item.playedAt >= start && item.playedAt <= end)
}

export const filterDailyByRange = (daily: LX.Stats.DailyItem[], range: TimeRange): LX.Stats.DailyItem[] => {
  const start = getRangeStart(range)
  const end = getRangeEnd(range)
  return daily.filter(item => {
    const time = new Date(`${item.date}T00:00:00`).getTime()
    return time >= start && time <= end
  })
}

export const filterSongByRange = (song: LX.Stats.SongItem[], range: TimeRange): LX.Stats.SongItem[] => {
  const start = getRangeStart(range)
  const end = getRangeEnd(range)
  return song.filter(item => item.lastPlayedAt >= start && item.firstPlayedAt <= end)
}

/** 当前连续活跃天数 + 历史最长连续 */
export const calcStreak = (daily: LX.Stats.DailyItem[]): { current: number; max: number } => {
  const sorted = [...daily]
    .filter(item => item.active)
    .map(item => item.date)
    .sort()
  if (!sorted.length) return { current: 0, max: 0 }
  const activeSet = new Set(sorted)
  let max = 0
  let current = 0
  // 从今天往回数当前连续
  const today = toDateText(new Date())
  const todayTime = new Date(`${today}T00:00:00`).getTime()
  for (let i = 0; i < 100000; i++) {
    const d = new Date(todayTime - i * DAY)
    const key = toDateText(d)
    if (activeSet.has(key)) current++
    else break
  }
  // 历史最长
  let run = 0
  let prev: string | null = null
  for (const key of sorted) {
    if (prev && new Date(`${key}T00:00:00`).getTime() - new Date(`${prev}T00:00:00`).getTime() === DAY) {
      run++
    } else {
      run = 1
    }
    if (run > max) max = run
    prev = key
  }
  return { current, max }
}

/** 周期内日均时长（秒） */
export const calcDailyAvg = (daily: LX.Stats.DailyItem[], range: TimeRange): number => {
  const items = filterDailyByRange(daily, range)
  if (!items.length) return 0
  const total = items.reduce((sum, item) => sum + item.duration, 0)
  const days = range === 'all' ? Math.max(1, items.length) : Math.max(1, Math.round(rangeLength(range) / DAY))
  return Math.round(total / days)
}

/** 本期 vs 上期每日时长序列 + 变化百分比 */
export const calcTrendCompare = (
  daily: LX.Stats.DailyItem[],
  range: TimeRange
): { current: number[]; previous: number[]; deltaPct: number } => {
  const map = new Map<string, number>()
  for (const item of daily) map.set(item.date, item.duration)

  // “全部”范围没有上期，按实际每日记录展示即可，不补零到 1970 年。
  if (range === 'all') {
    const keys = Array.from(map.keys()).sort()
    const current = keys.map(key => map.get(key) ?? 0).slice(-365)
    const sum = (arr: number[]) => arr.reduce((s, n) => s + n, 0)
    const curSum = sum(current)
    return { current, previous: [], deltaPct: 0 }
  }

  const dayCount = Math.max(1, Math.round(rangeLength(range) / DAY))
  const start = getRangeStart(range)
  const prevStart = getPrevRangeStart(range)

  const build = (from: number): number[] => {
    const result: number[] = []
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(from + i * DAY)
      result.push(map.get(toDateText(d)) ?? 0)
    }
    return result
  }
  const current = build(start)
  const previous = build(prevStart)
  const sum = (arr: number[]) => arr.reduce((s, n) => s + n, 0)
  const curSum = sum(current)
  const prevSum = sum(previous)
  const deltaPct = prevSum > 0 ? Math.round(((curSum - prevSum) / prevSum) * 100) : 0
  return { current, previous, deltaPct }
}

/** 香农多样性指数归一化 */
const calcDiversity = (song: LX.Stats.SongItem[], range: TimeRange): number => {
  const items = filterSongByRange(song, range)
  const total = items.reduce((sum, item) => sum + item.plays, 0)
  if (!items.length || total <= 0) return 0
  let entropy = 0
  for (const item of items) {
    if (item.plays <= 0) continue
    const p = item.plays / total
    entropy -= p * Math.log(p)
  }
  const max = Math.log(Math.max(2, items.length))
  return max > 0 ? Math.min(1, entropy / max) : 0
}

const calcLateNight = (events: LX.Stats.EventItem[], range: TimeRange): number => {
  const items = filterByRange(events, range)
  let late = 0
  let total = 0
  for (const e of items) {
    total += e.playTime
    const h = new Date(e.playedAt).getHours()
    if (h >= 23 || h < 5) late += e.playTime
  }
  return total > 0 ? late / total : 0
}

const calcRepeat = (events: LX.Stats.EventItem[], range: TimeRange): number => {
  const items = filterByRange(events, range)
  if (!items.length) return 0
  const counts = new Map<string, number>()
  for (const e of items) {
    const id = e.musicInfo?.id ?? ''
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const total = items.length
  const top = Math.max(0, ...counts.values())
  return total > 0 ? top / total : 0
}

const calcCompletion = (events: LX.Stats.EventItem[], range: TimeRange): number => {
  const items = filterByRange(events, range)
  if (!items.length) return 0
  const done = items.filter(e => e.maxTime > 0 && e.playTime / e.maxTime >= 0.9).length
  return done / items.length
}

const calcActivity = (daily: LX.Stats.DailyItem[], range: TimeRange): number => {
  const items = filterDailyByRange(daily, range)
  if (!items.length) return 0
  const active = items.filter(item => item.active).length
  const days = range === 'all' ? items.length : Math.max(1, Math.round(rangeLength(range) / DAY))
  return Math.min(1, active / days)
}

const calcDiscovery = (song: LX.Stats.SongItem[], events: LX.Stats.EventItem[], range: TimeRange): number => {
  const start = getRangeStart(range)
  const end = getRangeEnd(range)
  const periodSongs = song.filter(item => item.lastPlayedAt >= start && item.firstPlayedAt <= end)
  if (!periodSongs.length) return 0
  const firstPlayedInPeriod = periodSongs.filter(item => item.firstPlayedAt >= start && item.firstPlayedAt <= end).length
  return Math.min(1, firstPlayedInPeriod / periodSongs.length)
}

export const calcRadarProfile = (
  song: LX.Stats.SongItem[],
  events: LX.Stats.EventItem[],
  daily: LX.Stats.DailyItem[],
  range: TimeRange
): {
  diversity: number
  lateNight: number
  repeat: number
  completion: number
  activity: number
  discovery: number
} => ({
  diversity: calcDiversity(song, range),
  lateNight: calcLateNight(events, range),
  repeat: calcRepeat(events, range),
  completion: calcCompletion(events, range),
  activity: calcActivity(daily, range),
  discovery: calcDiscovery(song, events, range),
})

export interface PyramidTier {
  tier: string
  count: number
  plays: number
  sample?: string
}

export const calcPyramidTiers = (song: LX.Stats.SongItem[], range: TimeRange): PyramidTier[] => {
  const items = filterSongByRange(song, range)
  const tiers: PyramidTier[] = [
    { tier: '循环之王', count: 0, plays: 0 },
    { tier: '常听', count: 0, plays: 0 },
    { tier: '偶听', count: 0, plays: 0 },
    { tier: '试听', count: 0, plays: 0 },
  ]
  for (const item of items) {
    const plays = item.plays
    let index: number
    if (plays >= 10) index = 0
    else if (plays >= 5) index = 1
    else if (plays >= 2) index = 2
    else if (plays >= 1) index = 3
    else continue
    tiers[index].count++
    tiers[index].plays += plays
    if (!tiers[index].sample) tiers[index].sample = item.name
  }
  return tiers
}

export const calcHourlyDist = (events: LX.Stats.EventItem[], range: TimeRange): number[] => {
  const result = new Array(24).fill(0) as number[]
  for (const e of filterByRange(events, range)) {
    const h = new Date(e.playedAt).getHours()
    result[h] += 1
  }
  return result
}

export const calcWeekdayDist = (daily: LX.Stats.DailyItem[], range: TimeRange): number[] => {
  const result = new Array(7).fill(0) as number[]
  for (const item of filterDailyByRange(daily, range)) {
    const d = new Date(`${item.date}T00:00:00`)
    const w = (d.getDay() + 6) % 7
    result[w] += item.duration
  }
  return result
}

export const calcEffectiveRatio = (
  events: LX.Stats.EventItem[],
  range: TimeRange
): { effective: number; ineffective: number } => {
  const items = filterByRange(events, range)
  const effective = items.filter(e => e.isEffective).length
  const ineffective = items.length - effective
  return { effective, ineffective }
}

export const calcCompletionRate = (
  events: LX.Stats.EventItem[],
  range: TimeRange
): Array<{ bucket: string; count: number }> => {
  const buckets = [
    { bucket: '0-20%', count: 0 },
    { bucket: '20-50%', count: 0 },
    { bucket: '50-80%', count: 0 },
    { bucket: '80-100%', count: 0 },
  ]
  for (const e of filterByRange(events, range)) {
    const ratio = e.maxTime > 0 ? e.playTime / e.maxTime : 0
    if (ratio < 0.2) buckets[0].count++
    else if (ratio < 0.5) buckets[1].count++
    else if (ratio < 0.8) buckets[2].count++
    else buckets[3].count++
  }
  return buckets
}

export const calcSourceDist = (
  history: LX.Player.PlayHistoryItem[],
  range: TimeRange
): Array<{ source: string; count: number; ratio: number }> => {
  const items = filterByRange(history, range)
  const total = items.length
  const map = new Map<string, number>()
  for (const item of items) {
    const key = item.source || 'List'
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([source, count]) => ({ source, count, ratio: total > 0 ? count / total : 0 }))
    .sort((a, b) => b.count - a.count)
}

export const getRecentEvents = (events: LX.Stats.EventItem[], limit: number): LX.Stats.EventItem[] =>
  [...events].sort((a, b) => b.playedAt - a.playedAt).slice(0, limit)

/** 友好相对时间 */
export const formatRelativeTime = (time: number): string => {
  const diff = Date.now() - time
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}
