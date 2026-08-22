/**
 * 本地听歌统计 —— 埋点/结算层
 *
 * 设计:
 *  - 切歌/暂停/结束/播放事件驱动 + 自建 BackgroundTimer 每 2 秒轮询播放位置
 *  - 锁屏时 playProgress 轮询会停,因此这里独立轮询,保证时长不丢
 *  - AppState 回到前台时补一次位置差值
 */
import { AppState } from 'react-native'
import BackgroundTimer from 'react-native-background-timer'
import playerState from '@/store/player/state'
import { addStatsRecordQueued, backfillStatsFromHistory, getStatsDaily, getStatsEvents, getStatsSong } from '@/core/player/stats'
import { isAboveStatsThreshold } from '@/core/player/statsThreshold'
import { isOneDriveMusicInfo } from '@/core/oneDrive/utils'
import { getPosition, getDuration } from '@/plugins/player'

const POLL_INTERVAL_MS = 2000
const MAX_CONTINUOUS_DELTA = 60 * 60

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

const settleSession = () => {
  const session = currentSession
  if (!session) return
  currentSession = null
  if (session.accumulatedTime <= 0) return

  const finalize = (maxTime = session.maxTime) => {
    void addStatsRecordQueued({
      musicInfo: session.musicInfo,
      playedAt: session.playedAt,
      playTime: session.accumulatedTime,
      maxTime,
      isEffective: session.isEffective,
    })
  }

  if (session.maxTime > 0) {
    finalize()
    return
  }
  void getDuration()
    .then((duration) => finalize(duration && duration > 0 ? duration : 0))
    .catch(() => finalize())
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

const getCurrentMusicInfo = () => {
  const raw = playerState.playMusicInfo.musicInfo
  if (!raw) return null
  return 'progress' in raw ? raw.metadata.musicInfo : raw
}

const handleMusicToggled = () => {
  settleSession()
  const musicInfo = getCurrentMusicInfo()
  if (!musicInfo || isOneDriveMusicInfo(musicInfo)) return
  createSession(musicInfo)
}

const handlePause = () => settleSession()

const handlePlayerEnded = () => settleSession()

const handlePlay = () => {
  if (currentSession) return
  const musicInfo = getCurrentMusicInfo()
  if (!musicInfo || !playerState.isPlay || isOneDriveMusicInfo(musicInfo)) return
  createSession(musicInfo)
}

const pollPlayPosition = () => {
  const session = currentSession
  if (!session || !playerState.isPlay) return

  void getPosition().then((position) => {
    const s = currentSession
    if (!s || s !== session || !position) return

    if (position < s.lastProgressTime) {
      s.lastProgressTime = position
      return
    }

    const delta = position - s.lastProgressTime
    if (delta > 0 && delta < MAX_CONTINUOUS_DELTA) {
      s.accumulatedTime += delta
      if (!s.isEffective && isAboveStatsThreshold(s.accumulatedTime, s.maxTime)) {
        s.isEffective = true
      }
    }
    s.lastProgressTime = position
  })
}

export default () => {
  void backfillStatsFromHistory()

  global.app_event.on('musicToggled', handleMusicToggled)
  global.app_event.on('pause', handlePause)
  global.app_event.on('playerEnded', handlePlayerEnded)
  global.app_event.on('play', handlePlay)

  if (pollTimer != null) BackgroundTimer.clearInterval(pollTimer)
  pollTimer = BackgroundTimer.setInterval(pollPlayPosition, POLL_INTERVAL_MS)

  AppState.addEventListener('change', (state) => {
    if (state === 'active') pollPlayPosition()
  })

  // 启动 5 秒后预热统计缓存,避免用户进入统计页时才解析大 JSON
  setTimeout(() => {
    void getStatsDaily()
    void getStatsSong()
    void getStatsEvents()
  }, 5000)
}
