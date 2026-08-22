import playerState from '@/store/player/state'
import { addPlayHistory } from '@/core/player/playHistory'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import settingState from '@/store/setting/state'
import { isOneDriveMusicInfo } from '@/core/oneDrive/utils'

const getMinPlayTime = () => settingState.setting['stats.minPlayTime'] ?? 30
const getMinPlayRatio = () => (settingState.setting['stats.minPlayRatio'] ?? 50) / 100

const isAboveStatsThreshold = (nowPlayTime: number, maxPlayTime: number) => {
  const minPlayTime = getMinPlayTime()
  const minPlayRatio = getMinPlayRatio()
  const priority = settingState.setting['stats.priority'] ?? 'timeFirst'

  if (priority === 'time') {
    return nowPlayTime >= minPlayTime
  }
  if (priority === 'ratio') {
    if (maxPlayTime > 0) return nowPlayTime / maxPlayTime >= minPlayRatio
    return nowPlayTime >= minPlayTime
  }
  if (priority === 'ratioFirst') {
    if (maxPlayTime > 0) {
      if (nowPlayTime / maxPlayTime < minPlayRatio) return false
    } else if (nowPlayTime < minPlayTime) return false
    return nowPlayTime >= minPlayTime
  }
  // 都满足,先看秒数(默认)
  if (nowPlayTime < minPlayTime) return false
  if (maxPlayTime > 0 && nowPlayTime / maxPlayTime < minPlayRatio) return false
  return true
}

export default () => {
  let currentMusicInfo: LX.Music.MusicInfo | null = null
  let currentListId: string | null = null
  let isRecorded = false

  const handleMusicToggled = () => {
    const playMusicInfo = playerState.playMusicInfo
    const musicInfoRaw = playMusicInfo.musicInfo
    isRecorded = false
    currentMusicInfo = null
    currentListId = null
    if (!musicInfoRaw) return

    currentMusicInfo = 'progress' in musicInfoRaw ? musicInfoRaw.metadata.musicInfo : musicInfoRaw
    if (isOneDriveMusicInfo(currentMusicInfo)) {
      currentMusicInfo = null
      return
    }
    currentListId = playMusicInfo.listId === LIST_IDS.TEMP
      ? listState.tempListMeta.id ?? playMusicInfo.listId
      : playMusicInfo.listId
  }

  const handlePlayProgressChanged: typeof global.state_event.playProgressChanged = (progress) => {
    if (isRecorded || !currentMusicInfo) return
    if (!isAboveStatsThreshold(progress.nowPlayTime, progress.maxPlayTime)) return

    isRecorded = true
    void addPlayHistory({
      musicInfo: currentMusicInfo,
      playTime: progress.nowPlayTime,
      maxTime: progress.maxPlayTime,
      listId: currentListId,
    })
  }

  global.app_event.on('musicToggled', handleMusicToggled)
  global.state_event.on('playProgressChanged', handlePlayProgressChanged)
}
