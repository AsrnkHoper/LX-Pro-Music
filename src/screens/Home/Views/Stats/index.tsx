import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import Badge from '@/components/common/Badge'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'
import MonthHeatMap from './MonthHeatMap'
import YearOverview from './YearOverview'
import { getStatsEvents, getStatsOverview, getStatsSong, getStatsTopArtists, getStatsTopSongs } from '@/core/player/stats'
import { playOnlineList } from '@/core/list'
import { getPlayHistory } from '@/utils/data'
import { formatDurationFull, formatNumber, getTodayText } from './utils'
import AiReportSection from './AiReportSection'
import DataManager from './DataManager'

const RankItem = memo(
  ({
    rank,
    title,
    subtitle,
    value,
    valueLabel,
    onPress,
    detail,
    showDetail,
  }: {
    rank: number
    title: string
    subtitle: string
    value: string
    valueLabel: string
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
                {detail?.interval ? `${detail.interval} · ` : ''}播放 {value} 次
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

const Stats = memo(() => {
  const theme = useTheme()
  const [overview, setOverview] = useState<LX.Stats.Overview>({ totalPlays: 0, totalDuration: 0, activeDays: 0 })
  const [topSongs, setTopSongs] = useState<LX.Stats.SongItem[]>([])
  const [topArtists, setTopArtists] = useState<Array<{ singer: string; plays: number; duration: number }>>([])
  const [monthOverview, setMonthOverview] = useState<LX.Stats.Overview>({ totalPlays: 0, totalDuration: 0, activeDays: 0 })
  const [yearOverview, setYearOverview] = useState<LX.Stats.Overview>({ totalPlays: 0, totalDuration: 0, activeDays: 0 })
  const [recentEvents, setRecentEvents] = useState<LX.Stats.EventItem[]>([])
  const [durationSongs, setDurationSongs] = useState<LX.Stats.SongItem[]>([])
  const [selectedDate, setSelectedDate] = useState(getTodayText())
  const showDetail = useSettingValue('stats.rankDetail')
  const heatDetail = useSettingValue('stats.heatDetail')
  const activeTab = useSettingValue('stats.activeTab')
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
    ]).then(([all, month, year, songs, artists, events, allSongs]) => {
      setOverview(all)
      setMonthOverview(month)
      setYearOverview(year)
      setTopSongs(songs)
      setTopArtists(artists)
      setRecentEvents(
        events
          .slice(-10)
          .reverse()
      )
      setDurationSongs(
        allSongs
          .filter((item) => item.duration > 0)
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10)
      )
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

  const rankSongs = useMemo(
    () =>
      topSongs.map((item, index) => ({
        rank: index + 1,
        title: item.name,
        subtitle: item.singer,
        value: `${item.plays}`,
        valueLabel: '次',
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
          onPress={() => updateSetting({ 'stats.activeTab': 'overview' })}
        >
          <Text size={13} color={activeTab === 'overview' ? '#fff' : theme['c-font']}>统计</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'calendar' && styles.tabBtnActive]}
          onPress={() => updateSetting({ 'stats.activeTab': 'calendar' })}
        >
          <Text size={13} color={activeTab === 'calendar' ? '#fff' : theme['c-font']}>日历</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'config' && styles.tabBtnActive]}
          onPress={() => updateSetting({ 'stats.activeTab': 'config' })}
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

          {/* 歌曲排行 */}
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>播放次数排行</Text>
            <TouchableOpacity onPress={() => updateSetting({ 'stats.rankDetail': !showDetail })} style={styles.detailToggle}>
              <Text size={11} color={theme['c-primary']}>{showDetail ? '简洁' : '详细'}</Text>
            </TouchableOpacity>
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
                  valueLabel=""
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
          </View>
          <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
            {recentEvents.length === 0 ? (
              <Text size={12} color={theme['c-500']} style={styles.empty}>暂无数据</Text>
            ) : (
              recentEvents.slice(0, 8).map((event, index) => (
                <RankItem
                  key={`recent_${event.id}_${index}`}
                  rank={index + 1}
                  title={event.musicInfo.name}
                  subtitle={event.musicInfo.singer}
                  value={formatDurationFull(event.playTime)}
                  valueLabel=""
                  onPress={() => handlePlaySong({ id: event.musicInfo.id ?? '', name: event.musicInfo.name, singer: event.musicInfo.singer, album: event.musicInfo.meta.albumName ?? '', plays: 0, duration: event.playTime, firstPlayedAt: event.playedAt, lastPlayedAt: event.playedAt })}
                />
              ))
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
            showDetail={heatDetail}
            onToggleDetail={() => updateSetting({ 'stats.heatDetail': !heatDetail })}
          />
          <View style={styles.sectionHeader}>
            <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>年度总览</Text>
          </View>
          <YearOverview />
        </ScrollView>
      ) : null}

      {activeTab === 'config' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
