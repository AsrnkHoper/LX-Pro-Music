/**
 * 本地听歌统计 —— 数据层
 *
 * 三层存储:
 *  - @stats_daily  每日聚合(永久)
 *  - @stats_song   歌曲维度(永久)
 *  - @stats_events 原始事件(90 天)
 *
 * 口径:
 *  - 有效收听:累计 ≥120s 或 ≥50%
 *  - 入账本:播放 ≥50% 且 ≥30 秒(短歌 <30s 则要求听完)
 */
import { storageDataPrefix } from '@/config/constant'
import settingState from '@/store/setting/state'
import { getData, getDataMultiple, saveDataMultiple } from '@/plugins/storage'
import { getPlayHistory } from '@/utils/data'

const statsDailyKey = storageDataPrefix.statsDaily
const statsSongKey = storageDataPrefix.statsSong
const statsEventsKey = storageDataPrefix.statsEvents

const DAY = 24 * 60 * 60 * 1000
const MAX_EVENT_DAYS = 90
const MIN_RECORD_TIME = 30
const MIN_RECORD_RATIO = 0.5

// 轻量内存缓存:统计页频繁读取时避免反复 JSON.parse 大数组
let dailyCache: LX.Stats.DailyItem[] | null = null
let songCache: LX.Stats.SongItem[] | null = null
let eventsCache: LX.Stats.EventItem[] | null = null

const invalidateStatsCache = () => {
  dailyCache = null
  songCache = null
  eventsCache = null
}

const getHistoryDay = (time: number) => {
  const d = new Date(time)
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

const getDayStart = (dateText: string) => new Date(`${dateText}T00:00:00`).getTime()

export const getStatsDaily = async () => {
  if (dailyCache) return dailyCache
  dailyCache = (await getData<LX.Stats.DailyItem[] | null>(statsDailyKey)) ?? []
  return dailyCache
}

export const getStatsSong = async () => {
  if (songCache) return songCache
  songCache = (await getData<LX.Stats.SongItem[] | null>(statsSongKey)) ?? []
  return songCache
}

export const getStatsEvents = async () => {
  if (eventsCache) return eventsCache
  eventsCache = (await getData<LX.Stats.EventItem[] | null>(statsEventsKey)) ?? []
  return eventsCache
}

export const addStatsRecord = async (params: {
  musicInfo: LX.Music.MusicInfo
  playedAt: number
  playTime: number
  maxTime: number
  isEffective: boolean
}) => {
  const { musicInfo, playedAt, playTime, maxTime, isEffective } = params

  // 入账门槛:读取用户配置,短歌(<设定秒数)听完才入;普通歌需同时满足秒数与比例
  const minPlayTime = settingState.setting['stats.minPlayTime'] ?? MIN_RECORD_TIME
  const minPlayRatio = (settingState.setting['stats.minPlayRatio'] ?? 50) / 100
  const ratio = maxTime > 0 ? playTime / maxTime : 0
  if (maxTime > 0 && maxTime < minPlayTime) {
    if (playTime < maxTime) return
  } else if (playTime < minPlayTime || ratio < minPlayRatio) {
    return
  }

  const date = getHistoryDay(playedAt)
  const [dailyResult, songResult, eventResult] = await getDataMultiple([
    statsDailyKey,
    statsSongKey,
    statsEventsKey,
  ])
  const daily = (dailyResult[1] as LX.Stats.DailyItem[] | null) ?? []
  const song = (songResult[1] as LX.Stats.SongItem[] | null) ?? []
  const events = (eventResult[1] as LX.Stats.EventItem[] | null) ?? []

  const dayItem = daily.find((item) => item.date === date)
  if (dayItem) {
    if (isEffective) {
      dayItem.plays += 1
      dayItem.active = true
    }
    dayItem.duration += playTime
  } else {
    daily.push({ date, plays: isEffective ? 1 : 0, duration: playTime, active: isEffective })
  }

  const songId = musicInfo.id ?? ''
  const songItem = song.find((item) => item.id === songId)
  if (songItem) {
    if (isEffective) songItem.plays += 1
    songItem.duration += playTime
    if (playedAt > songItem.lastPlayedAt) songItem.lastPlayedAt = playedAt
  } else {
    song.push({
      id: songId,
      name: musicInfo.name,
      singer: musicInfo.singer,
      album: musicInfo.meta.albumName ?? '',
      plays: isEffective ? 1 : 0,
      duration: playTime,
      firstPlayedAt: playedAt,
      lastPlayedAt: playedAt,
    })
  }

  events.push({
    id: `${songId}_${playedAt}`,
    musicInfo,
    playedAt,
    playTime,
    maxTime,
    isEffective,
  })

  const cutoff = Date.now() - MAX_EVENT_DAYS * DAY
  for (let i = events.length - 1; i > -1; i--) {
    if (events[i].playedAt < cutoff) events.splice(i, 1)
  }

  await saveDataMultiple([
    [statsDailyKey, daily],
    [statsSongKey, song],
    [statsEventsKey, events],
  ])
  invalidateStatsCache()
  global.app_event.statsUpdated()
}

let statsQueue = Promise.resolve()
export const addStatsRecordQueued = (params: Parameters<typeof addStatsRecord>[0]) => {
  const next = statsQueue.catch(() => {}).then(() => addStatsRecord(params))
  statsQueue = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

export const deleteStatsDay = async (date: string) => {
  const [dailyResult, songResult, eventResult] = await getDataMultiple([
    statsDailyKey,
    statsSongKey,
    statsEventsKey,
  ])
  const daily = (dailyResult[1] as LX.Stats.DailyItem[] | null) ?? []
  const song = (songResult[1] as LX.Stats.SongItem[] | null) ?? []
  const events = (eventResult[1] as LX.Stats.EventItem[] | null) ?? []

  const start = getDayStart(date)
  const end = start + DAY - 1
  const dayEvents = events.filter((item) => item.playedAt >= start && item.playedAt <= end)

  for (const event of dayEvents) {
    const id = event.musicInfo.id ?? ''
    const songItem = song.find((item) => item.id === id)
    if (!songItem) continue
    if (event.isEffective) songItem.plays = Math.max(0, songItem.plays - 1)
    songItem.duration = Math.max(0, songItem.duration - event.playTime)
    if (songItem.plays <= 0 && songItem.duration <= 0) song.splice(song.indexOf(songItem), 1)
  }

  const dayIndex = daily.findIndex((item) => item.date === date)
  if (dayIndex > -1) daily.splice(dayIndex, 1)

  for (let i = events.length - 1; i > -1; i--) {
    if (events[i].playedAt >= start && events[i].playedAt <= end) events.splice(i, 1)
  }

  await saveDataMultiple([
    [statsDailyKey, daily],
    [statsSongKey, song],
    [statsEventsKey, events],
  ])
  invalidateStatsCache()
  global.app_event.statsUpdated()
}

export const exportStatsData = async () => {
  const [daily, song, events] = await Promise.all([getStatsDaily(), getStatsSong(), getStatsEvents()])
  return {
    type: 'lx_stats_data',
    version: 1,
    exportedAt: Date.now(),
    daily,
    song,
    events,
  }
}

export const importStatsData = async (data: any) => {
  const daily = Array.isArray(data?.daily) ? data.daily : []
  const song = Array.isArray(data?.song) ? data.song : []
  const events = Array.isArray(data?.events) ? data.events : []
  await saveDataMultiple([
    [statsDailyKey, daily],
    [statsSongKey, song],
    [statsEventsKey, events],
  ])
  invalidateStatsCache()
  global.app_event.statsUpdated()
}

export const clearStats = async () => {
  await saveDataMultiple([
    [statsDailyKey, []],
    [statsSongKey, []],
    [statsEventsKey, []],
  ])
  invalidateStatsCache()
  global.app_event.statsUpdated()
}

export const backfillStatsFromHistory = async () => {
  const daily = await getStatsDaily()
  if (daily.length > 0) return

  const history = await getPlayHistory()
  if (!history.length) return

  const dailyMap = new Map<string, LX.Stats.DailyItem>()
  const songMap = new Map<string, LX.Stats.SongItem>()

  for (const item of history) {
    const date = getHistoryDay(item.playedAt)
    const songId = item.musicInfo.id ?? ''

    let day = dailyMap.get(date)
    if (!day) {
      day = { date, plays: 0, duration: 0, active: false }
      dailyMap.set(date, day)
    }
    day.plays += 1
    day.duration += item.playTime
    day.active = true

    let song = songMap.get(songId)
    if (!song) {
      song = {
        id: songId,
        name: item.musicInfo.name,
        singer: item.musicInfo.singer,
        album: item.musicInfo.meta.albumName ?? '',
        plays: 0,
        duration: 0,
        firstPlayedAt: item.playedAt,
        lastPlayedAt: item.playedAt,
      }
      songMap.set(songId, song)
    }
    song.plays += 1
    song.duration += item.playTime
    if (item.playedAt < song.firstPlayedAt) song.firstPlayedAt = item.playedAt
    if (item.playedAt > song.lastPlayedAt) song.lastPlayedAt = item.playedAt
  }

  await saveDataMultiple([
    [statsDailyKey, Array.from(dailyMap.values())],
    [statsSongKey, Array.from(songMap.values())],
  ])
  invalidateStatsCache()
  global.app_event.statsUpdated()
}

export const getStatsDailyByRange = async (startTime: number, endTime: number) => {
  const daily = await getStatsDaily()
  return daily.filter((item) => {
    const t = getDayStart(item.date)
    return t >= startTime && t <= endTime
  })
}

export const getStatsDailyByDay = async (date: string) => {
  const daily = await getStatsDaily()
  return daily.find((item) => item.date === date) ?? null
}

export const getStatsEventsByDay = async (date: string) => {
  const events = await getStatsEvents()
  const start = getDayStart(date)
  const end = start + DAY - 1
  return events.filter((item) => item.playedAt >= start && item.playedAt <= end)
}

export const getStatsOverview = async (startTime?: number, endTime?: number): Promise<LX.Stats.Overview> => {
  const daily = await getStatsDaily()
  let items = daily
  if (startTime != null || endTime != null) {
    items = daily.filter((item) => {
      const t = getDayStart(item.date)
      if (startTime != null && t < startTime) return false
      if (endTime != null && t > endTime) return false
      return true
    })
  }
  let totalPlays = 0
  let totalDuration = 0
  let activeDays = 0
  for (const item of items) {
    totalPlays += item.plays
    totalDuration += item.duration
    if (item.active) activeDays += 1
  }
  return { totalPlays, totalDuration, activeDays }
}

export const getStatsTopSongs = async (limit = 20) => {
  const song = await getStatsSong()
  return song
    .filter((item) => item.plays > 0)
    .sort((a, b) => b.plays - a.plays || b.duration - a.duration)
    .slice(0, limit)
}

export const getStatsTopArtists = async (limit = 20) => {
  const song = await getStatsSong()
  const map = new Map<string, { singer: string; plays: number; duration: number; lastPlayedAt: number }>()
  for (const item of song) {
    if (item.plays <= 0) continue
    const singer = item.singer || '未知歌手'
    const current = map.get(singer)
    if (current) {
      current.plays += item.plays
      current.duration += item.duration
      if (item.lastPlayedAt > current.lastPlayedAt) current.lastPlayedAt = item.lastPlayedAt
    } else {
      map.set(singer, { singer, plays: item.plays, duration: item.duration, lastPlayedAt: item.lastPlayedAt })
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.plays - a.plays || b.duration - a.duration)
    .slice(0, limit)
}
