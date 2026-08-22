/**
 * 听歌统计口径统一工具
 *
 * 三处同步:
 *  - core/player/stats.ts          数据层入账门槛
 *  - core/init/player/playHistory.ts 播放历史入账门槛
 *  - core/init/player/stats.ts      埋点结算 effective 判定
 *
 * 后续修改统计口径只需改这里,避免三处逻辑漂移。
 */
import settingState from '@/store/setting/state'

export const DEFAULT_MIN_PLAY_TIME = 30
export const DEFAULT_MIN_PLAY_RATIO = 50

export const getStatsMinPlayTime = () =>
  settingState.setting['stats.minPlayTime'] ?? DEFAULT_MIN_PLAY_TIME

export const getStatsMinPlayRatio = () =>
  (settingState.setting['stats.minPlayRatio'] ?? DEFAULT_MIN_PLAY_RATIO) / 100

export const getStatsPriority = (): LX.AppSetting['stats.priority'] =>
  settingState.setting['stats.priority'] ?? 'timeFirst'

/**
 * 是否达到统计入账门槛
 * @param playTime 累计播放时长(秒)
 * @param maxTime 歌曲总时长(秒),未知时传 0
 */
export const isAboveStatsThreshold = (playTime: number, maxTime: number): boolean => {
  const minPlayTime = getStatsMinPlayTime()
  const minPlayRatio = getStatsMinPlayRatio()
  const priority = getStatsPriority()
  const ratio = maxTime > 0 ? playTime / maxTime : 0

  if (priority === 'time') {
    return playTime >= minPlayTime
  }
  if (priority === 'ratio') {
    if (maxTime > 0) return ratio >= minPlayRatio
    return playTime >= minPlayTime
  }
  if (priority === 'ratioFirst') {
    if (maxTime > 0) {
      if (ratio < minPlayRatio) return false
    } else if (playTime < minPlayTime) return false
    return playTime >= minPlayTime
  }
  // 都满足,先看秒数(默认)
  if (playTime < minPlayTime) return false
  if (maxTime > 0 && ratio < minPlayRatio) return false
  return true
}
