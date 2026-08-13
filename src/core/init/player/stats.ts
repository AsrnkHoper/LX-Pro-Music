import BackgroundTimer from 'react-native-background-timer'
import { AppState } from 'react-native'
import playerState from '@/store/player/state'
import { addStatsRecordQueued, backfillStatsFromHistory } from '@/core/player/stats'
import { isOneDriveMusicInfo } from '@/core/oneDrive/utils'
import { getPosition } from '@/plugins/player'

/**
 * 本地听歌统计 —— 埋点/结算层
 *
 * 照抄 playHistory.ts(有效收听判定)+ scrobble.ts(实际播放秒数 delta 累加)模式:
 *  - musicToggled:切歌 → 结算上一曲,记录新曲上下文
 *  - 自建 BackgroundTimer 轮询:每 2s 查询原生播放位置 getPosition(),
 *    连续播放时累加实际秒数。不用 playProgressChanged 事件——
 *    因为 playProgress.ts 在锁屏(isScreenOn=false)时会停止进度轮询,
 *    依赖它会导致锁屏听歌时长完全不计。
 *  - pause:暂停 → 结算当前累计
 *  - playerEnded:播放结束 → 结算当前累计
 *
 * 口径(见策划文档第四节):
 *  - 有效收听 = 累计 ≥120s 或 ≥50% → 计入次数/排行/活跃天数
 *  - 实际播放秒数 → 计入总时长/热力图深浅(不受阈值限制)
 */

const MIN_PLAY_TIME = 2 * 60
const MIN_PLAY_RATIO = 0.5
/** 轮询间隔(秒) */
const POLL_INTERVAL_MS = 2000
/** 连续播放判定阈值:相邻轮询位置差小于此值视为连续播放(拖动进度条跳变不计入) */
const MAX_CONTINUOUS_DELTA = 60 * 60  // 放宽到 1 小时:锁屏期间轮询可能长时间不触发,解锁后一次性补上大差值

interface Session {
  musicInfo: LX.Music.MusicInfo
  playedAt: number
  accumulatedTime: number
  lastProgressTime: number
  maxTime: number
  isEffective: boolean
}

let currentSession: Session | null = null
let pollTimer: number | null = null

/** 结算当前会话:写入统计层(直接用轮询累计的时长,简单可靠) */
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

const createSession = (musicInfo: LX.Music.MusicInfo) => {
  currentSession = {
    musicInfo,
    playedAt: Date.now(),
    accumulatedTime: 0,
    lastProgressTime: 0,
    maxTime: playerState.progress.maxPlayTime ?? 0,
    isEffective: false,
  }
}

const handleMusicToggled = () => {
  // 切歌:先结算上一曲
  settleSession()

  const playMusicInfo = playerState.playMusicInfo
  const musicInfoRaw = playMusicInfo.musicInfo
  if (!musicInfoRaw) return

  const musicInfo = 'progress' in musicInfoRaw ? musicInfoRaw.metadata.musicInfo : musicInfoRaw
  if (isOneDriveMusicInfo(musicInfo)) return

  createSession(musicInfo)
}

/**
 * 后台轮询:每 2s 查询原生播放位置,连续播放时累加实际秒数
 * 独立于 playProgress 的进度轮询,锁屏/后台依然有效
 */
const pollPlayPosition = () => {
  const session = currentSession
  if (!session || !playerState.isPlay) return

  void getPosition().then((position) => {
    const s = currentSession
    if (!s || s !== session || !position) return

    const nowPlayTime = position
    // 位置回退(切歌后归零/进度条后退):重置基线,不累加
    if (nowPlayTime < s.lastProgressTime) {
      s.lastProgressTime = nowPlayTime
      return
    }

    const delta = nowPlayTime - s.lastProgressTime
    // 只在连续播放时累加(轮询间隔 2s,允许 30s 误差应对后台节流;拖动进度条跳变不计入)
    if (delta > 0 && delta < MAX_CONTINUOUS_DELTA) {
      s.accumulatedTime += delta

      // 有效收听判定:累计 ≥120s 或 ≥50%(与 scrobble 口径一致)
      if (!s.isEffective) {
        if (
          s.accumulatedTime >= MIN_PLAY_TIME ||
          (s.maxTime > 0 && s.accumulatedTime / s.maxTime >= MIN_PLAY_RATIO)
        ) {
          s.isEffective = true
        }
      }
    }

    s.lastProgressTime = nowPlayTime
  })
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

  createSession(musicInfo)
}

export default () => {
  // 首次启动回填播放历史(仅当统计为空时执行一次)
  void backfillStatsFromHistory()
  console.log('STATS_V2_MARKER_20260806_CONFIRM')

  global.app_event.on('musicToggled', handleMusicToggled)
  global.app_event.on('pause', handlePause)
  global.app_event.on('playerEnded', handlePlayerEnded)
  global.app_event.on('play', handlePlay)

  // 自建后台轮询,锁屏也持续累计时长
  if (pollTimer != null) BackgroundTimer.clearInterval(pollTimer)
  pollTimer = BackgroundTimer.setInterval(pollPlayPosition, POLL_INTERVAL_MS)

  // AppState 恢复前台时立即结算一次:
  // 锁屏期间轮询可能被系统挂起,解锁瞬间用 getPosition() 把锁屏播放的时长差值补上
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      pollPlayPosition()
    }
  })
}
