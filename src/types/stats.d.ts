declare namespace LX {
  namespace Stats {
    /**
     * 每日聚合(永久保留)
     * 按天一条:次数(有效收听)/时长(实际播放秒数)/活跃度
     */
    interface DailyItem {
      /** 日期 YYYY-MM-DD */
      date: string
      /** 有效收听次数(累计 ≥120s 或 ≥50% 算一次) */
      plays: number
      /** 实际播放秒数(不受阈值限制) */
      duration: number
      /** 当天是否有 ≥1 次有效收听 */
      active: boolean
    }

    /**
     * 歌曲维度聚合(永久保留)
     * 每首歌一条:累计次数/首次播放/最近播放
     */
    interface SongItem {
      /** 歌曲 id(musicInfo.id) */
      id: string
      name: string
      singer: string
      album: string
      /** 有效收听次数 */
      plays: number
      /** 实际播放秒数 */
      duration: number
      /** 首次播放时间戳 */
      firstPlayedAt: number
      /** 最近播放时间戳 */
      lastPlayedAt: number
    }

    /**
     * 原始播放事件(只留 90 天)
     * 每次结算(切歌/暂停/结束)一条,记录实际播放明细
     */
    interface EventItem {
      id: string
      /** 歌曲摘要,不存完整 musicInfo 避免膨胀 */
      musicInfo: LX.Music.MusicInfo
      /** 播放开始时间戳 */
      playedAt: number
      /** 实际播放秒数 */
      playTime: number
      /** 歌曲总时长秒数 */
      maxTime: number
      /** 是否有效收听 */
      isEffective: boolean
    }

    /** 概览统计 */
    interface Overview {
      /** 有效收听总次数 */
      totalPlays: number
      /** 实际播放总时长(秒) */
      totalDuration: number
      /** 活跃天数(有 ≥1 次有效收听) */
      activeDays: number
    }
  }
}
