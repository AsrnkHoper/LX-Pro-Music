import { saveDataMultiple, getDataMultiple, getData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { getPlayHistory } from '@/utils/data'

/**
 * 本地听歌统计 —— 数据层(事实层)
 *
 * 三个存储 key(方案 C 混合制,见策划文档第四节):
 *  - @stats_daily  每日聚合(次数/时长/活跃度),永久
 *  - @stats_song   歌曲维度(累计次数/首次播放/最近播放),永久
 *  - @stats_events 原始事件(每次播放明细),只留 90 天
 *
 * 统计口径(方案 A+D):
 *  - 有效收听判定:累计 ≥120s 或 ≥50% —— 只影响次数/排行/活跃天数
 *  - 时长类统计:按实际播放秒数累加,不受阈值限制 —— 影响总时长/热力图深浅
 */

const statsDailyKey = storageDataPrefix.statsDaily
const statsSongKey = storageDataPrefix.statsSong
const statsEventsKey = storageDataPrefix.statsEvents

/** 原始事件保留天数 */
const MAX_EVENT_DAYS = 90
/** 最短入账时长(秒):播放不足此值不入账本,过滤极短试听 */
const MIN_RECORD_TIME = 30
/** 最短入账比例:播放不足歌曲时长此比例不入账本(短歌听一半也入账,长歌试听不入) */
const MIN_RECORD_RATIO = 0.5
const DAY = 24 * 60 * 60 * 1000

export const getStatsDaily = async () => {
  return (await getData<LX.Stats.DailyItem[] | null>(statsDailyKey)) ?? []
}

export const getStatsSong = async () => {
  return (await getData<LX.Stats.SongItem[] | null>(statsSongKey)) ?? []
}

export const getStatsEvents = async () => {
  return (await getData<LX.Stats.EventItem[] | null>(statsEventsKey)) ?? []
}

const getHistoryDay = (time: number) => {
  const date = new Date(time)
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

const getDayStart = (time: number) => new Date(new Date(time).getFullYear(), new Date(time).getMonth(), new Date(time).getDate()).getTime()

/**
 * 结算一次播放:更新每日聚合 + 歌曲维度,追加原始事件,并清理过期事件
 * @param params.musicInfo 歌曲信息(摘要)
 * @param params.playedAt  本次播放的开始时间戳
 * @param params.playTime  实际播放秒数(不受阈值限制)
 * @param params.maxTime   歌曲总时长秒数
 * @param params.isEffective 是否有效收听(≥120s 或 ≥50%)
 */
export const addStatsRecord = async (params: {
  musicInfo: LX.Music.MusicInfo
  playedAt: number
  playTime: number
  maxTime: number
  isEffective: boolean
}) => {
  const { musicInfo, playedAt, playTime, maxTime, isEffective } = params

  // 入账门槛:
  // - 短歌(总时长 <30 秒,如剪切过的片段):必须听完(100%)才计入
  //   (有人喜欢听十几二十秒的片段歌,听完整首应算数)
  // - 正常歌(≥30 秒):播放 ≥30 秒 且 ≥50%
  const playRatio = maxTime > 0 ? playTime / maxTime : 0
  if (maxTime > 0 && maxTime < MIN_RECORD_TIME) {
    // 短歌:听完才入账(实际播放不可能超过 maxTime,等价于 100%)
    if (playTime < maxTime) return
  } else {
    if (playTime < MIN_RECORD_TIME || playRatio < MIN_RECORD_RATIO) return
  }

  const date = getHistoryDay(playedAt)

  const [dailyList, songList, eventList] = await getDataMultiple([statsDailyKey, statsSongKey, statsEventsKey])
  const daily = (dailyList[1] as LX.Stats.DailyItem[] | null) ?? []
  const song = (songList[1] as LX.Stats.SongItem[] | null) ?? []
  const events = (eventList[1] as LX.Stats.EventItem[] | null) ?? []

  // 每日聚合
  let dayItem = daily.find(item => item.date === date)
  if (dayItem) {
    if (isEffective) {
      dayItem.plays += 1
      dayItem.active = true
    }
    dayItem.duration += playTime
  } else {
    daily.push({
      date,
      plays: isEffective ? 1 : 0,
      duration: playTime,
      active: isEffective,
    })
  }

  // 歌曲维度聚合
  const songId = musicInfo.id ?? ''
  let songItem = song.find(item => item.id === songId)
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

  // 原始事件(只留 90 天)
  events.push({
    id: `${songId}_${playedAt}`,
    musicInfo,
    playedAt,
    playTime,
    maxTime,
    isEffective,
  })
  const cutoff = Date.now() - MAX_EVENT_DAYS * DAY
  for (let index = events.length - 1; index > -1; index--) {
    if (events[index].playedAt < cutoff) events.splice(index, 1)
  }

  await saveDataMultiple([[statsDailyKey, daily], [statsSongKey, song], [statsEventsKey, events]])
  global.app_event.statsUpdated()
}

/** 串行化写入队列,避免并发写覆盖 */
let statsQueue = Promise.resolve()
export const addStatsRecordQueued = (params: Parameters<typeof addStatsRecord>[0]) => {
  const nextTask = statsQueue.catch(() => {}).then(() => addStatsRecord(params))
  statsQueue = nextTask.then(() => undefined, () => undefined)
  return nextTask
}

/**
 * 删除某天的统计(长按热力图格子时调用,给用户数据控制权)
 * 删除:每日聚合中该天、该天的原始事件;歌曲维度从该天事件中扣减
 */
export const deleteStatsDay = async (date: string) => {
  const [dailyList, songList, eventList] = await getDataMultiple([statsDailyKey, statsSongKey, statsEventsKey])
  const daily = (dailyList[1] as LX.Stats.DailyItem[] | null) ?? []
  const song = (songList[1] as LX.Stats.SongItem[] | null) ?? []
  const events = (eventList[1] as LX.Stats.EventItem[] | null) ?? []

  const dayStart = new Date(`${date}T00:00:00`).getTime()
  const dayEnd = dayStart + DAY - 1
  const dayEvents = events.filter(item => item.playedAt >= dayStart && item.playedAt <= dayEnd)

  // 从歌曲维度扣减该天贡献
  for (const event of dayEvents) {
    const songId = event.musicInfo.id ?? ''
    const songItem = song.find(item => item.id === songId)
    if (!songItem) continue
    if (event.isEffective) songItem.plays = Math.max(0, songItem.plays - 1)
    songItem.duration = Math.max(0, songItem.duration - event.playTime)
    if (songItem.plays <= 0 && songItem.duration <= 0) {
      song.splice(song.indexOf(songItem), 1)
    }
  }

  // 删除每日聚合该天
  const dayIndex = daily.findIndex(item => item.date === date)
  if (dayIndex > -1) daily.splice(dayIndex, 1)

  // 删除该天原始事件
  for (let index = events.length - 1; index > -1; index--) {
    if (events[index].playedAt >= dayStart && events[index].playedAt <= dayEnd) events.splice(index, 1)
  }

  await saveDataMultiple([[statsDailyKey, daily], [statsSongKey, song], [statsEventsKey, events]])
  global.app_event.statsUpdated()
}

/** 清空全部统计(设置页备用) */
export const clearStats = async () => {
  await saveDataMultiple([[statsDailyKey, []], [statsSongKey, []], [statsEventsKey, []]])
  global.app_event.statsUpdated()
}

/**
 * 回填:首次启动时用现有播放历史(@play_history)聚合出初始 daily/song 数据
 * 让热力图/概览打开即有数据。仅当 @stats_daily 为空时执行一次。
 */
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

    let dayItem = dailyMap.get(date)
    if (!dayItem) {
      dayItem = { date, plays: 0, duration: 0, active: false }
      dailyMap.set(date, dayItem)
    }
    dayItem.plays += 1
    dayItem.duration += item.playTime
    dayItem.active = true

    let songItem = songMap.get(songId)
    if (!songItem) {
      songItem = {
        id: songId,
        name: item.musicInfo.name,
        singer: item.musicInfo.singer,
        album: item.musicInfo.meta.albumName ?? '',
        plays: 0,
        duration: 0,
        firstPlayedAt: item.playedAt,
        lastPlayedAt: item.playedAt,
      }
      songMap.set(songId, songItem)
    }
    songItem.plays += 1
    songItem.duration += item.playTime
    if (item.playedAt < songItem.firstPlayedAt) songItem.firstPlayedAt = item.playedAt
    if (item.playedAt > songItem.lastPlayedAt) songItem.lastPlayedAt = item.playedAt
  }

  await saveDataMultiple([
    [statsDailyKey, Array.from(dailyMap.values())],
    [statsSongKey, Array.from(songMap.values())],
  ])
  global.app_event.statsUpdated()
}

/** 查询:按日期范围取每日聚合 */
export const getStatsDailyByRange = async (startTime: number, endTime: number) => {
  const daily = await getStatsDaily()
  return daily.filter(item => {
    const time = new Date(`${item.date}T00:00:00`).getTime()
    return time >= startTime && time <= endTime
  })
}

/** 查询:某天的原始事件(当天账本) */
export const getStatsEventsByDay = async (date: string) => {
  const events = await getStatsEvents()
  const dayStart = new Date(`${date}T00:00:00`).getTime()
  const dayEnd = dayStart + DAY - 1
  return events.filter(item => item.playedAt >= dayStart && item.playedAt <= dayEnd)
}

/** 查询:某天的每日聚合 */
export const getStatsDailyByDay = async (date: string) => {
  const daily = await getStatsDaily()
  return daily.find(item => item.date === date) ?? null
}

/** 查询:概览(总次数/总时长/活跃天数),可指定范围(毫秒时间戳,不传则全部) */
export const getStatsOverview = async (startTime?: number, endTime?: number): Promise<LX.Stats.Overview> => {
  const daily = await getStatsDaily()
  let items = daily
  if (startTime != null || endTime != null) {
    items = daily.filter(item => {
      const time = new Date(`${item.date}T00:00:00`).getTime()
      if (startTime != null && time < startTime) return false
      if (endTime != null && time > endTime) return false
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

/** 查询:歌曲排行(按有效次数降序) */
export const getStatsTopSongs = async (limit = 50) => {
  const song = await getStatsSong()
  return song
    .filter(item => item.plays > 0)
    .sort((a, b) => b.plays - a.plays || b.duration - a.duration)
    .slice(0, limit)
}

/** 查询:歌手排行(按有效次数汇总) */
export const getStatsTopArtists = async (limit = 50) => {
  const song = await getStatsSong()
  const artistMap = new Map<string, { singer: string; plays: number; duration: number; lastPlayedAt: number }>()
  for (const item of song) {
    if (item.plays <= 0) continue
    const artist = artistMap.get(item.singer)
    if (artist) {
      artist.plays += item.plays
      artist.duration += item.duration
      if (item.lastPlayedAt > artist.lastPlayedAt) artist.lastPlayedAt = item.lastPlayedAt
    } else {
      artistMap.set(item.singer, { singer: item.singer, plays: item.plays, duration: item.duration, lastPlayedAt: item.lastPlayedAt })
    }
  }
  return Array.from(artistMap.values())
    .sort((a, b) => b.plays - a.plays || b.duration - a.duration)
    .slice(0, limit)
}

export const getStatsDayStart = getDayStart
