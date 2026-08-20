import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import Badge from '@/components/common/Badge'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import { saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import MonthHeatMap from './MonthHeatMap'
import YearOverview from './YearOverview'
import { getStatsDaily, getStatsEvents, getStatsOverview, getStatsSong, getStatsTopArtists, getStatsTopSongs } from '@/core/player/stats'
import { playOnlineList } from '@/core/list'
import { getPlayHistory } from '@/utils/data'
import { formatDurationFull, formatNumber, getTodayText } from './utils'
import AiReportSection from './AiReportSection'
import DataManager from './DataManager'
import StatsConfig from './StatsConfig'
import RadarChart from './RadarChart'
import ActivityCompareChart from './ActivityCompareChart'
import DonutChart from './DonutChart'

const RankItem = memo(
  ({
    rank,
    title,
    subtitle,
    value,
    valueLabel,
    detailValueLabel,
    onPress,
    detail,
    showDetail,
  }: {
    rank: number
    title: string
    subtitle: string
    value: string
    valueLabel: string
    detailValueLabel?: string
    onPress?: () => void
    detail?: {
      picUrl?: string | null
      source?: string
      quality?: string
      interval?: string | null
      album?: string
    }
    showDetail?: boolean
  }) => {
    const theme = useTheme()
    const rankColor =
      rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#d97706' : 'rgba(128,128,128,0.25)'
    return (
      <TouchableOpacity style={styles.rankItem} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
        <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
          <Text size={12} color="#fff" style={styles.rankBadgeText}>{rank}</Text>
        </View>
        {showDetail ? (
          <>
            <Image url={detail?.picUrl} style={styles.rankCover} />
            <View style={[styles.rankMain, styles.rankMainDetail]}>
              <View style={styles.rankTitleRow}>
                <Text size={14} color={theme['c-font']} numberOfLines={1} style={styles.rankTitleText}>{title}</Text>
                {detail?.source ? <Badge type="tertiary">{detail.source.toUpperCase()}</Badge> : null}
                {detail?.quality ? <Badge type="hq">{detail.quality}</Badge> : null}
              </View>
              <Text size={11} color={theme['c-500']} numberOfLines={1}>
                {subtitle}{detail?.album ? ` · ${detail.album}` : ''}
              </Text>
              <Text size={11} color={theme['c-500']} numberOfLines={1}>
                {detail?.interval ? `${detail.interval} · ` : ''}{detailValueLabel ?? valueLabel} {value}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.rankMain}>
              <Text size={14} color={theme['c-font']} numberOfLines={1}>{title}</Text>
              {subtitle ? (
                <Text size={11} color={theme['c-500']} numberOfLines={1}>{subtitle}</Text>
              ) : null}
            </View>
          </>
        )}
        <View style={styles.rankValue}>
          <Text size={14} color={theme['c-primary']} style={styles.rankValueText}>{value}</Text>
          <Text size={10} color={theme['c-500']}>{valueLabel}</Text>
        </View>
      </TouchableOpacity>
    )
  }
)

const ListPlayButtons = memo(({ onPlayAll, onRandomPlay }: { onPlayAll: () => void; onRandomPlay: () => void }) => {
  const theme = useTheme()
  return (
    <View style={styles.miniActions}>
      <TouchableOpacity style={styles.miniActionBtn} onPress={onPlayAll}>
        <Text size={11} color={theme['c-primary']}>播放全部</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.miniActionBtn} onPress={onRandomPlay}>
        <Text size={11} color={theme['c-primary']}>随机播放</Text>
      </TouchableOpacity>
    </View>
  )
})

const Stats = memo(() => {
  const theme = useTheme()
  const [overview, setOverview] = useState<LX.Stats.Overview>({ totalPlays: 0, totalDuration: 0, activeDays: 0 })
  const [topSongs, setTopSongs] = useState<LX.Stats.SongItem[]>([])
  const [topArtists, setTopArtists] = useState<Array<{ singer: string; plays: number; duration: number }>>([])
  const [monthOverview, setMonthOverview] = useState<LX.Stats.Overview>({ totalPlays: 0, totalDuration: 0, activeDays: 0 })
  const [yearOverview, setYearOverview] = useState<LX.Stats.Overview>({ totalPlays: 0, totalDuration: 0, activeDays: 0 })
  const [recentEvents, setRecentEvents] = useState<LX.Stats.EventItem[]>([])
  const [durationSongs, setDurationSongs] = useState<LX.Stats.SongItem[]>([])
  const [hourCounts, setHourCounts] = useState<number[]>(new Array(24).fill(0))
  const [radarData, setRadarData] = useState<{ label: string; value: number }[]>([])
  const [activityMode, setActivityMode] = useState<'month' | 'year'>('month')
  const [monthCurrent, setMonthCurrent] = useState<number[]>([])
  const [monthPrevious, setMonthPrevious] = useState<number[]>([])
  const [yearCurrent, setYearCurrent] = useState<number[]>(new Array(12).fill(0))
  const [yearPrevious, setYearPrevious] = useState<number[]>(new Array(12).fill(0))
  const [sourceDistribution, setSourceDistribution] = useState<{ label: string; value: number }[]>([])
  const [monthFavorites, setMonthFavorites] = useState<{
    topSong?: { name: string; singer: string; plays: number }
    topArtist?: { name: string; plays: number }
    topAlbum?: { name: string; plays: number }
  }>({})
  const [habits, setHabits] = useState<{
    topHour: number
    avgDailyMin: number
    longestStreak: number
    monthActiveRate: number
  }>({ topHour: 0, avgDailyMin: 0, longestStreak: 0, monthActiveRate: 0 })
  const [longTerm, setLongTerm] = useState<{
    topArtist?: { name: string; duration: number }
    topAlbum?: { name: string; duration: number }
    topSource?: { name: string; duration: number }
  }>({})
  const [selectedDate, setSelectedDate] = useState(getTodayText())
  const showDetail = useSettingValue('stats.detailMode')
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'config'>(
    settingState.setting['stats.activeTab'] ?? 'overview'
  )
  const [detailMap, setDetailMap] = useState<Record<string, {
    picUrl?: string | null
    source?: string
    quality?: string
    interval?: string | null
    album?: string
    musicInfo?: LX.Music.MusicInfo
  }>>({})

  const loadAll = useCallback(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime()
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1).getTime() - 1
    void Promise.all([
      getStatsOverview(),
      getStatsOverview(monthStart, monthEnd),
      getStatsOverview(yearStart, yearEnd),
      getStatsTopSongs(10),
      getStatsTopArtists(10),
      getStatsEvents(),
      getStatsSong(),
      getStatsDaily(),
    ]).then(([all, month, year, songs, artists, events, allSongs, daily]) => {
      setOverview(all)
      setMonthOverview(month)
      setYearOverview(year)
      setTopSongs(songs)
      setTopArtists(artists)
      setRecentEvents(events.slice(-10).reverse())
      setDurationSongs(
        allSongs
          .filter((item) => item.duration > 0)
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10)
      )

      // 本月最常听
      const monthEvents = events.filter((e) => e.playedAt >= monthStart && e.playedAt <= monthEnd)
      const songAgg = new Map<string, { name: string; singer: string; plays: number }>()
      const artistAgg = new Map<string, { name: string; plays: number }>()
      const albumAgg = new Map<string, { name: string; plays: number }>()
      for (const e of monthEvents) {
        const id = e.musicInfo?.id ?? ''
        const name = e.musicInfo?.name ?? ''
        const singer = e.musicInfo?.singer ?? ''
        const album = e.musicInfo?.meta?.albumName || '未知专辑'
        if (id) {
          const s = songAgg.get(id) ?? { name, singer, plays: 0 }
          s.plays += 1; songAgg.set(id, s)
        }
        if (singer) {
          const a = artistAgg.get(singer) ?? { name: singer, plays: 0 }
          a.plays += 1; artistAgg.set(singer, a)
        }
        if (album) {
          const al = albumAgg.get(album) ?? { name: album, plays: 0 }
          al.plays += 1; albumAgg.set(album, al)
        }
      }
      const topSongLocal = Array.from(songAgg.values()).sort((a, b) => b.plays - a.plays)[0]
      const topArtistLocal = Array.from(artistAgg.values()).sort((a, b) => b.plays - a.plays)[0]
      const topAlbumLocal = Array.from(albumAgg.values()).sort((a, b) => b.plays - a.plays)[0]
      setMonthFavorites({
        topSong: topSongLocal,
        topArtist: topArtistLocal,
        topAlbum: topAlbumLocal,
      })

      // 听歌习惯
      const hourCount = new Array(24).fill(0)
      for (const e of events) {
        hourCount[new Date(e.playedAt).getHours()] += 1
      }
      let topHour = 0
      hourCount.forEach((count, hour) => {
        if (count > hourCount[topHour]) topHour = hour
      })
      const activeDays = daily.filter((d) => d.active).length
      const totalDailyDuration = daily.reduce((sum, d) => sum + d.duration, 0)
      const avgDailyMin = activeDays > 0 ? Math.round(totalDailyDuration / 60 / activeDays) : 0
      const sortedDates = daily.filter((d) => d.active).map((d) => d.date).sort()
      let longestStreak = 0
      let streak = 0
      let prevDate: Date | null = null
      for (const dateText of sortedDates) {
        const date = new Date(`${dateText}T00:00:00`)
        if (prevDate && date.getTime() - prevDate.getTime() === 86400000) {
          streak += 1
        } else {
          streak = 1
        }
        prevDate = date
        if (streak > longestStreak) longestStreak = streak
      }
      const daysElapsedMonth = Math.max(1, Math.floor((Date.now() - monthStart) / 86400000) + 1)
      const monthActiveDays = daily.filter((d) => d.active && d.date >= `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`).length
      const activeRate = monthActiveDays / Math.min(daysElapsedMonth, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())
      setHabits({
        topHour,
        avgDailyMin,
        longestStreak,
        monthActiveRate: Math.round(activeRate * 100),
      })

      // 活跃时间分布与听歌画像
      setHourCounts(hourCount)
      const monthTotal = monthEvents.length || 1
      const lateNightCount = monthEvents.filter((e) => {
        const hour = new Date(e.playedAt).getHours()
        return hour >= 23 || hour < 5
      }).length
      const completionAvg =
        monthEvents.length > 0
          ? monthEvents.reduce((sum, e) => sum + (e.maxTime > 0 ? Math.min(1, e.playTime / e.maxTime) : 0), 0) / monthEvents.length
          : 0
      const firstThisMonth = allSongs.filter((s) => s.firstPlayedAt >= monthStart && s.firstPlayedAt <= monthEnd).length
      setRadarData([
        { label: '多样性', value: Math.min(1, songAgg.size / monthTotal) },
        { label: '深夜', value: Math.min(1, lateNightCount / monthTotal) },
        { label: '循环', value: topSongLocal ? Math.min(1, topSongLocal.plays / monthTotal) : 0 },
        { label: '完听', value: completionAvg },
        { label: '活跃', value: Math.min(1, activeRate) },
        { label: '探索', value: Math.min(1, firstThisMonth / Math.max(1, songAgg.size)) },
      ])

      // 活跃时长对比数据
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth(), 0)
      const daysInPrevMonth = prevMonthDate.getDate()
      const mCur = new Array(daysInMonth).fill(0)
      const mPrev = new Array(daysInPrevMonth).fill(0)
      for (const d of daily) {
        const date = new Date(`${d.date}T00:00:00`)
        if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
          mCur[date.getDate() - 1] = d.duration
        } else if (date.getFullYear() === prevMonthDate.getFullYear() && date.getMonth() === prevMonthDate.getMonth()) {
          mPrev[date.getDate() - 1] = d.duration
        }
      }
      setMonthCurrent(mCur)
      setMonthPrevious(mPrev)

      const yCur = new Array(12).fill(0)
      const yPrev = new Array(12).fill(0)
      for (const d of daily) {
        const date = new Date(`${d.date}T00:00:00`)
        if (date.getFullYear() === now.getFullYear()) {
          yCur[date.getMonth()] += d.duration
        } else if (date.getFullYear() === now.getFullYear() - 1) {
          yPrev[date.getMonth()] += d.duration
        }
      }
      setYearCurrent(yCur)
      setYearPrevious(yPrev)

      // 长期偏好画像(按累计时长)
      const artistDur = new Map<string, { name: string; duration: number }>()
      const albumDur = new Map<string, { name: string; duration: number }>()
      const sourceDur = new Map<string, { name: string; duration: number }>()
      for (const e of events) {
        const singer = e.musicInfo?.singer ?? ''
        const album = e.musicInfo?.meta?.albumName || '未知专辑'
        const source = e.musicInfo?.source ?? '未知'
        if (singer) {
          const a = artistDur.get(singer) ?? { name: singer, duration: 0 }
          a.duration += e.playTime; artistDur.set(singer, a)
        }
        const al = albumDur.get(album) ?? { name: album, duration: 0 }
        al.duration += e.playTime; albumDur.set(album, al)
        const so = sourceDur.get(source) ?? { name: source, duration: 0 }
        so.duration += e.playTime; sourceDur.set(source, so)
      }
      const sortedSources = Array.from(sourceDur.values()).sort((a, b) => b.duration - a.duration)
      setLongTerm({
        topArtist: Array.from(artistDur.values()).sort((a, b) => b.duration - a.duration)[0],
        topAlbum: Array.from(albumDur.values()).sort((a, b) => b.duration - a.duration)[0],
        topSource: sortedSources[0],
      })
      setSourceDistribution(sortedSources.map((item) => ({ label: item.name, value: item.duration })))

    })
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    const buildDetailMap = async () => {
      const map: Record<string, any> = {}
      try {
        const events = await getStatsEvents()
        for (const event of events) {
          const info = event.musicInfo as LX.Music.MusicInfoOnline
          if (!info?.id || map[info.id]) continue
          const meta = info.meta || {}
          map[info.id] = {
            picUrl: meta.picUrl ?? (meta as any).picUrl,
            source: info.source,
            quality: meta._qualitys ? Object.keys(meta._qualitys).find((q) => meta._qualitys[q as LX.Quality]) : undefined,
            interval: info.interval,
            album: meta.albumName,
            musicInfo: info,
          }
        }
      } catch {
        // ignore
      }
      try {
        const history = await getPlayHistory()
        for (const item of history) {
          const info = item.musicInfo as LX.Music.MusicInfoOnline
          if (!info?.id || map[info.id]) continue
          const meta = info.meta || {}
          map[info.id] = {
            picUrl: meta.picUrl ?? (meta as any).picUrl,
            source: info.source,
            quality: meta._qualitys ? Object.keys(meta._qualitys).find((q) => meta._qualitys[q as LX.Quality]) : undefined,
            interval: info.interval,
            album: meta.albumName,
            musicInfo: info,
          }
        }
      } catch {
        // ignore
      }
      setDetailMap(map)
    }
    void buildDetailMap()
  }, [topSongs])

  useEffect(() => {
    const handleStatsUpdated = () => loadAll()
    global.app_event.on('statsUpdated', handleStatsUpdated)
    return () => {
      global.app_event.off('statsUpdated', handleStatsUpdated)
    }
  }, [loadAll])

  const handleTabChange = useCallback((tab: 'overview' | 'calendar' | 'config') => {
    setActiveTab(tab)
    settingState.setting['stats.activeTab'] = tab
    void saveData(storageDataPrefix.setting, settingState.setting)
  }, [])

  const handlePlaySong = useCallback((song: LX.Stats.SongItem) => {
    const detail = detailMap[song.id]
    const musicInfo = (detail?.musicInfo as LX.Music.MusicInfoOnline) ?? ({
      id: song.id,
      name: song.name,
      singer: song.singer,
      source: 'kw',
      interval: null,
      meta: {
        songId: song.id,
        albumName: song.album || '',
        qualitys: [],
        _qualitys: {},
      },
    } as LX.Music.MusicInfoOnline)
    void playOnlineList('stats_ranking', [musicInfo], 0)
  }, [detailMap])

  const buildSongList = useCallback((songs: LX.Stats.SongItem[]) => {
    return songs.map((song) => {
      const detail = detailMap[song.id]
      return (detail?.musicInfo as LX.Music.MusicInfoOnline) ?? ({
        id: song.id,
        name: song.name,
        singer: song.singer,
        source: 'kw',
        interval: null,
        meta: { songId: song.id, albumName: song.album || '', qualitys: [], _qualitys: {} },
      } as LX.Music.MusicInfoOnline)
    })
  }, [detailMap])

  const shuffleList = useCallback((list: LX.Music.MusicInfoOnline[]) => {
    const arr = [...list]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [])

  const handlePlayAllSongs = useCallback((songs: LX.Stats.SongItem[]) => {
    const list = buildSongList(songs)
    if (!list.length) return
    void playOnlineList('stats_songs', list, 0)
  }, [buildSongList])

  const handleRandomPlaySongs = useCallback((songs: LX.Stats.SongItem[]) => {
    const list = shuffleList(buildSongList(songs))
    if (!list.length) return
    void playOnlineList('stats_songs_random', list, 0)
  }, [buildSongList, shuffleList])

  const handlePlayAllEvents = useCallback((events: LX.Stats.EventItem[]) => {
    const seen = new Set<string>()
    const list = events
      .map((event) => event.musicInfo as LX.Music.MusicInfoOnline)
      .filter((info) => {
        const id = info?.id ?? ''
        if (!id || seen.has(id)) return false
        seen.add(id)
        return true
      })
    if (!list.length) return
    void playOnlineList('stats_recent', list, 0)
  }, [])

  const handleRandomPlayEvents = useCallback((events: LX.Stats.EventItem[]) => {
    const seen = new Set<string>()
    const list = events
      .map((event) => event.musicInfo as LX.Music.MusicInfoOnline)
      .filter((info) => {
        const id = info?.id ?? ''
        if (!id || seen.has(id)) return false
        seen.add(id)
        return true
      })
    if (!list.length) return
    void playOnlineList('stats_recent_random', shuffleList(list), 0)
  }, [shuffleList])

  const rankSongs = useMemo(
    () =>
      topSongs.map((item, index) => ({
        rank: index + 1,
        title: item.name,
        subtitle: item.singer,
        value: `${item.plays}`,
        valueLabel: '次',
        detailValueLabel: '播放',
        detail: detailMap[item.id],
      })),
    [topSongs, detailMap]
  )

  const rankArtists = useMemo(
    () =>
      topArtists.map((item, index) => ({
        rank: index + 1,
        title: item.singer,
        subtitle: '',
        value: `${item.plays}`,
        valueLabel: '次',
      })),
    [topArtists]
  )

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]}
          onPress={() => handleTabChange('overview')}
        >
          <Text size={13} color={activeTab === 'overview' ? '#fff' : theme['c-font']}>统计</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'calendar' && styles.tabBtnActive]}
          onPress={() => handleTabChange('calendar')}
        >
          <Text size={13} color={activeTab === 'calendar' ? '#fff' : theme['c-font']}>日历</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'config' && styles.tabBtnActive]}
          onPress={() => handleTabChange('config')}
        >
          <Text size={13} color={activeTab === 'config' ? '#fff' : theme['c-font']}>配置</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'overview' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroGlowLarge} />
            <View style={styles.heroGlowSmall} />
            <Text size={13} color="rgba(255,255,255,0.75)">YOUR LISTENING LIFE</Text>
            <Text size={30} color="#fff" style={styles.heroTitle}>你的听歌人生</Text>
            <Text size={14} color="rgba(255,255,255,0.82)" style={styles.heroSub}>
              每一段旋律,都在悄悄记录你
            </Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <Text size={24} color="#fff" style={styles.heroStatValue}>{formatDurationFull(overview.totalDuration)}</Text>
                <Text size={11} color="rgba(255,255,255,0.75)">累计时长</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStatItem}>
                <Text size={24} color="#fff" style={styles.heroStatValue}>{formatNumber(overview.totalPlays)}</Text>
                <Text size={11} color="rgba(255,255,255,0.75)">有效收听</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStatItem}>
                <Text size={24} color="#fff" style={styles.heroStatValue}>{formatNumber(overview.activeDays)}</Text>
                <Text size={11} color="rgba(255,255,255,0.75)">活跃天数</Text>
              </View>
            </View>
          </View>

          {/* 本月听歌报告 */}
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>本月听歌报告</Text>
            <Text size={11} color={theme['c-500']}>本地统计</Text>
          </View>
          <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
            <View style={styles.reportGrid}>
              <View style={styles.reportItem}>
                <Text size={20} color={theme['c-primary']} style={styles.reportValue}>{formatDurationFull(monthOverview.totalDuration)}</Text>
                <Text size={11} color={theme['c-500']}>听歌时长</Text>
              </View>
              <View style={styles.reportItem}>
                <Text size={20} color={theme['c-primary']} style={styles.reportValue}>{monthOverview.totalPlays}</Text>
                <Text size={11} color={theme['c-500']}>播放次数</Text>
              </View>
              <View style={styles.reportItem}>
                <Text size={20} color={theme['c-primary']} style={styles.reportValue}>{monthOverview.activeDays}</Text>
                <Text size={11} color={theme['c-500']}>活跃天数</Text>
              </View>
              <View style={styles.reportItem}>
                <Text size={20} color={theme['c-primary']} style={styles.reportValue}>{yearOverview.activeDays}</Text>
                <Text size={11} color={theme['c-500']}>今年活跃</Text>
              </View>
            </View>
          </View>

          {/* 本月最常听 */}
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>本月最常听</Text>
          </View>
          <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
            <View style={styles.favRow}>
              <Text size={13} color={theme['c-500']} style={styles.favLabel}>最爱歌手</Text>
              <Text size={14} color={theme['c-font']} numberOfLines={1} style={styles.favValue}>
                {monthFavorites.topArtist?.name ?? '暂无'}
                {monthFavorites.topArtist ? `  ${monthFavorites.topArtist.plays}次` : ''}
              </Text>
            </View>
            <View style={styles.favRow}>
              <Text size={13} color={theme['c-500']} style={styles.favLabel}>最爱歌曲</Text>
              <Text size={14} color={theme['c-font']} numberOfLines={1} style={styles.favValue}>
                {monthFavorites.topSong?.name ?? '暂无'}
                {monthFavorites.topSong ? `  ${monthFavorites.topSong.plays}次` : ''}
              </Text>
            </View>
            <View style={styles.favRow}>
              <Text size={13} color={theme['c-500']} style={styles.favLabel}>最爱专辑</Text>
              <Text size={14} color={theme['c-font']} numberOfLines={1} style={styles.favValue}>
                {monthFavorites.topAlbum?.name ?? '暂无'}
                {monthFavorites.topAlbum ? `  ${monthFavorites.topAlbum.plays}次` : ''}
              </Text>
            </View>
          </View>

          {/* 活跃时间分布 */}
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>活跃时间分布</Text>
          </View>
          <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
            <View style={styles.hourBars}>
              {hourCounts.map((count, hour) => {
                const max = Math.max(1, ...hourCounts)
                const height = count > 0 ? Math.max(6, Math.round((count / max) * 64)) : 2
                return (
                  <View key={hour} style={styles.hourBarCol}>
                    <View style={[styles.hourBarTrack, { height: 64 }]}>
                      <View style={[styles.hourBarFill, { height, backgroundColor: hour === habits.topHour ? theme['c-primary'] : theme['c-primary-alpha-500'] }]} />
                    </View>
                    <Text size={8} color={hour === habits.topHour ? theme['c-primary'] : theme['c-500']}>{hour}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          {/* 活跃时长对比 */}
          <ActivityCompareChart
            mode={activityMode}
            current={activityMode === 'month' ? monthCurrent : yearCurrent}
            previous={activityMode === 'month' ? monthPrevious : yearPrevious}
            currentLabel={activityMode === 'month' ? '本月' : '今年'}
            previousLabel={activityMode === 'month' ? '上月' : '去年'}
            onToggleMode={() => setActivityMode((v) => (v === 'month' ? 'year' : 'month'))}
          />

          {/* 听歌画像 */}
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>听歌画像</Text>
            <Text size={11} color={theme['c-500']}>六维本地计算</Text>
          </View>
          <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
            <RadarChart data={radarData} size={240} />
          </View>

          {/* 听歌习惯 */}
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>听歌习惯</Text>
          </View>
          <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
            <View style={styles.reportGrid}>
              <View style={styles.reportItem}>
                <Text size={20} color={theme['c-primary']} style={styles.reportValue}>{habits.topHour}:00</Text>
                <Text size={11} color={theme['c-500']}>常听时段</Text>
              </View>
              <View style={styles.reportItem}>
                <Text size={20} color={theme['c-primary']} style={styles.reportValue}>{habits.avgDailyMin}分</Text>
                <Text size={11} color={theme['c-500']}>活跃日均</Text>
              </View>
              <View style={styles.reportItem}>
                <Text size={20} color={theme['c-primary']} style={styles.reportValue}>{habits.longestStreak}天</Text>
                <Text size={11} color={theme['c-500']}>最长连续</Text>
              </View>
              <View style={styles.reportItem}>
                <Text size={20} color={theme['c-primary']} style={styles.reportValue}>{habits.monthActiveRate}%</Text>
                <Text size={11} color={theme['c-500']}>本月活跃</Text>
              </View>
            </View>
          </View>

          {/* 长期偏好画像 */}
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>长期偏好画像</Text>
            <Text size={11} color={theme['c-500']}>按累计收听时长</Text>
          </View>
          <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
            <View style={styles.favRow}>
              <Text size={13} color={theme['c-500']} style={styles.favLabel}>常听歌手</Text>
              <Text size={14} color={theme['c-font']} numberOfLines={1} style={styles.favValue}>
                {longTerm.topArtist?.name ?? '暂无'}
                {longTerm.topArtist ? `  ${formatDurationFull(longTerm.topArtist.duration)}` : ''}
              </Text>
            </View>
            <View style={styles.favRow}>
              <Text size={13} color={theme['c-500']} style={styles.favLabel}>常听专辑</Text>
              <Text size={14} color={theme['c-font']} numberOfLines={1} style={styles.favValue}>
                {longTerm.topAlbum?.name ?? '暂无'}
                {longTerm.topAlbum ? `  ${formatDurationFull(longTerm.topAlbum.duration)}` : ''}
              </Text>
            </View>
            <View style={styles.favRow}>
              <Text size={13} color={theme['c-500']} style={styles.favLabel}>常听音源</Text>
              <Text size={14} color={theme['c-font']} numberOfLines={1} style={styles.favValue}>
                {longTerm.topSource?.name ?? '暂无'}
                {longTerm.topSource ? `  ${formatDurationFull(longTerm.topSource.duration)}` : ''}
              </Text>
            </View>
          </View>

          {/* 音乐平台占比 */}
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>音乐平台占比</Text>
            <Text size={11} color={theme['c-500']}>按累计收听时长</Text>
          </View>
          <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
            {sourceDistribution.length === 0 ? (
              <Text size={12} color={theme['c-500']} style={styles.empty}>暂无数据</Text>
            ) : (
              <DonutChart data={sourceDistribution} size={180} />
            )}
          </View>

          {/* 歌曲排行 */}
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>播放次数排行</Text>
            <View style={styles.sectionHeaderRight}>
              <ListPlayButtons onPlayAll={() => handlePlayAllSongs(topSongs)} onRandomPlay={() => handleRandomPlaySongs(topSongs)} />
              <TouchableOpacity onPress={() => updateSetting({ 'stats.detailMode': !showDetail })} style={styles.detailToggle}>
                <Text size={11} color={theme['c-primary']}>{showDetail ? '简洁' : '详细'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
            {rankSongs.length === 0 ? (
              <Text size={12} color={theme['c-500']} style={styles.empty}>听歌后这里会出现你的年度最爱</Text>
            ) : (
              rankSongs.map((item, index) => (
                <RankItem
                  key={`song_${item.rank}`}
                  {...item}
                  showDetail={showDetail}
                  onPress={() => handlePlaySong(topSongs[index])}
                />
              ))
            )}
          </View>

          {/* 时长排行 */}
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>累计时长排行</Text>
            <ListPlayButtons onPlayAll={() => handlePlayAllSongs(durationSongs)} onRandomPlay={() => handleRandomPlaySongs(durationSongs)} />
          </View>
          <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
            {durationSongs.length === 0 ? (
              <Text size={12} color={theme['c-500']} style={styles.empty}>暂无数据</Text>
            ) : (
              durationSongs.map((item, index) => (
                <RankItem
                  key={`dur_${item.id}_${index}`}
                  rank={index + 1}
                  title={item.name}
                  subtitle={item.singer}
                  value={formatDurationFull(item.duration)}
                  valueLabel="累计"
                  detailValueLabel="累计"
                  detail={detailMap[item.id]}
                  showDetail={showDetail}
                  onPress={() => handlePlaySong(item)}
                />
              ))
            )}
          </View>

          {/* 歌手排行 */}
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>歌手排行</Text>
          </View>
          <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
            {rankArtists.length === 0 ? (
              <Text size={12} color={theme['c-500']} style={styles.empty}>听歌后这里会出现你偏爱的歌手</Text>
            ) : (
              rankArtists.map((item) => <RankItem key={`artist_${item.rank}`} {...item} />)
            )}
          </View>

          {/* 最近播放 */}
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>最近播放</Text>
            <ListPlayButtons onPlayAll={() => handlePlayAllEvents(recentEvents)} onRandomPlay={() => handleRandomPlayEvents(recentEvents)} />
          </View>
          <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
            {recentEvents.length === 0 ? (
              <Text size={12} color={theme['c-500']} style={styles.empty}>暂无数据</Text>
            ) : (
              recentEvents.slice(0, 8).map((event, index) => {
                const info = event.musicInfo as LX.Music.MusicInfoOnline
                return (
                  <RankItem
                    key={`recent_${event.id}_${index}`}
                    rank={index + 1}
                    title={info.name}
                    subtitle={info.singer}
                    value={formatDurationFull(event.playTime)}
                    valueLabel="播放"
                    detailValueLabel="播放"
                    detail={{
                      picUrl: info.meta?.picUrl,
                      source: info.source,
                      quality: info.meta?._qualitys ? Object.keys(info.meta._qualitys).find((q) => info.meta._qualitys[q as LX.Quality]) : undefined,
                      interval: info.interval,
                      album: info.meta?.albumName,
                    }}
                    showDetail={showDetail}
                    onPress={() => handlePlaySong({ id: info.id ?? '', name: info.name, singer: info.singer, album: info.meta?.albumName ?? '', plays: 0, duration: event.playTime, firstPlayedAt: event.playedAt, lastPlayedAt: event.playedAt })}
                  />
                )
              })
            )}
          </View>
        </ScrollView>
      ) : null}

      {activeTab === 'calendar' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>月度热力</Text>
            <Text size={11} color={theme['c-500']}>长按格子可删除当天数据</Text>
          </View>
          <MonthHeatMap
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            showDetail={showDetail}
            onToggleDetail={() => updateSetting({ 'stats.detailMode': !showDetail })}
          />
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>年度总览</Text>
          </View>
          <YearOverview />
        </ScrollView>
      ) : null}

      {activeTab === 'config' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <StatsConfig />
          <DataManager />
          <AiReportSection />
        </ScrollView>
      ) : null}
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  tabBtnActive: {
    backgroundColor: '#0f172a',
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  reportItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  reportValue: {
    fontWeight: '800',
  },
  hourBars: {
    flexDirection: 'row',
    gap: 3,
    paddingVertical: 4,
  },
  hourBarCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  hourBarTrack: {
    width: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(128,128,128,0.10)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  hourBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  favLabel: {
    width: 72,
  },
  favValue: {
    flex: 1,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    marginBottom: 20,
    position: 'relative',
  },
  heroGlowLarge: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(77,175,124,0.35)',
  },
  heroGlowSmall: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(245,158,11,0.18)',
  },
  heroTitle: {
    fontWeight: '800',
    marginTop: 4,
  },
  heroSub: {
    marginTop: 4,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontWeight: '800',
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniActions: {
    flexDirection: 'row',
    gap: 8,
  },
  miniActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(77,175,124,0.12)',
  },
  sectionTitle: {
    fontWeight: '700',
  },
  card: {
    borderRadius: 20,
    padding: 8,
    marginBottom: 16,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 16,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankCover: {
    width: 42,
    height: 42,
    borderRadius: 8,
    marginRight: 12,
  },
  rankTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rankTitleText: {
    flexShrink: 1,
  },
  detailToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(77,175,124,0.12)',
  },
  rankBadgeText: {
    fontWeight: '800',
  },
  rankMain: {
    flex: 1,
    marginHorizontal: 10,
  },
  rankMainDetail: {
    marginHorizontal: 0,
    marginRight: 8,
  },
  rankValue: {
    alignItems: 'flex-end',
  },
  rankValueText: {
    fontWeight: '700',
  },
  aiCard: {
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  aiMain: {
    flex: 1,
    marginHorizontal: 10,
  },
  aiTitle: {
    fontWeight: '700',
  },
  aiDesc: {
    marginTop: 2,
  },
  aiBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#0f172a',
  },
})

export default Stats
