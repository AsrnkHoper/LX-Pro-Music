import playerState from '@/store/player/state'
import { addStatsRecordQueued, backfillStatsFromHistory } from '@/core/player/stats'
import { isOneDriveMusicInfo } from '@/core/oneDrive/utils'

/**
 * 本地听歌统计 —— 埋点/结算层
 *
 * 照抄 playHistory.ts(有效收听判定)+ scrobble.ts(实际播放秒数 delta 累加)模式:
 *  - musicToggled:切歌 → 结算上一曲,记录新曲上下文
 *  - playProgressChanged:每秒轮询 → 连续播放时累加实际秒数(delta 方式,暂停/拖动不计)
 *  - pause:暂停 → 结算当前累计
 *  - playerEnded:播放结束 → 结算当前累计
 *
 * 口径(见策划文档第四节):
 *  - 有效收听 = 累计 ≥120s 或 ≥50% → 计入次数/排行/活跃天数
 *  - 实际播放秒数 → 计入总时长/热力图深浅(不受阈值限制)
 */

const MIN_PLAY_TIME = 2 * 60
const MIN_PLAY_RATIO = 0.5

interface Session {
  musicInfo: LX.Music.MusicInfo
  playedAt: number
  accumulatedTime: number
  lastProgressTime: number
  maxTime: number
  isEffective: boolean
}

let currentSession: Session | null = null

/** 结算当前会话:把累计的实际播放秒数写入统计层 */
const settleSession = () => {
  const session = currentSession
  if (!session) return
  currentSession = null
  if (session.accumulatedTime <= 0) return

  void addStatsRecordQueued({
    musicInfo: session.musicInfo,
    playedAt: session.playedAt,
    playTime: session.accumulatedTime,
    maxTime: session.maxTime,
    isEffective: session.isEffective,
  })
}

const handleMusicToggled = () => {
  // 切歌:先结算上一曲
  settleSession()

  const playMusicInfo = playerState.playMusicInfo
  const musicInfoRaw = playMusicInfo.musicInfo
  if (!musicInfoRaw) return

  const musicInfo = 'progress' in musicInfoRaw ? musicInfoRaw.metadata.musicInfo : musicInfoRaw
  if (isOneDriveMusicInfo(musicInfo)) return

  currentSession = {
    musicInfo,
    playedAt: Date.now(),
    accumulatedTime: 0,
    lastProgressTime: 0,
    maxTime: 0,
    isEffective: false,
  }
}

const handlePlayProgressChanged: typeof global.state_event.playProgressChanged = (progress) => {
  const session = currentSession
  if (!session || !playerState.isPlay) return

  const nowPlayTime = progress.nowPlayTime
  // 只在连续播放时累加(允许 1 秒误差,应对计时器延迟;拖动进度条导致跳变不计入)
  if (nowPlayTime > session.lastProgressTime && nowPlayTime - session.lastProgressTime <= 1) {
    session.accumulatedTime += nowPlayTime - session.lastProgressTime
  }
  session.lastProgressTime = nowPlayTime
  if (progress.maxPlayTime) session.maxTime = progress.maxPlayTime

  // 有效收听判定:累计 ≥120s 或 ≥50%(与 scrobble 口径一致)
  if (!session.isEffective) {
    if (
      session.accumulatedTime >= MIN_PLAY_TIME ||
      (session.maxTime > 0 && session.accumulatedTime / session.maxTime >= MIN_PLAY_RATIO)
    ) {
      session.isEffective = true
    }
  }
}

const handlePause = () => {
  settleSession()
}

const handlePlayerEnded = () => {
  settleSession()
}

/** 播放恢复时:若当前有曲目且上一会话已结算,重建会话上下文(暂停→恢复会被拆成两段明细,时长累计不受影响) */
const handlePlay = () => {
  if (currentSession) return
  const playMusicInfo = playerState.playMusicInfo
  const musicInfoRaw = playMusicInfo.musicInfo
  if (!musicInfoRaw || !playerState.isPlay) return

  const musicInfo = 'progress' in musicInfoRaw ? musicInfoRaw.metadata.musicInfo : musicInfoRaw
  if (isOneDriveMusicInfo(musicInfo)) return

  currentSession = {
    musicInfo,
    playedAt: Date.now(),
    accumulatedTime: 0,
    lastProgressTime: 0,
    maxTime: 0,
    isEffective: false,
  }
}

export default () => {
  // 首次启动回填播放历史(仅当统计为空时执行一次)
  void backfillStatsFromHistory()

  global.app_event.on('musicToggled', handleMusicToggled)
  global.app_event.on('pause', handlePause)
  global.app_event.on('playerEnded', handlePlayerEnded)
  global.app_event.on('play', handlePlay)
  global.state_event.on('playProgressChanged', handlePlayProgressChanged)
}
