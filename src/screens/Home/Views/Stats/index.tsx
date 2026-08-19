import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import MonthHeatMap from './MonthHeatMap'
import YearOverview from './YearOverview'
import { getStatsOverview, getStatsTopArtists, getStatsTopSongs } from '@/core/player/stats'
import { formatDurationFull, formatNumber, getTodayText } from './utils'
import AiReportSection from './AiReportSection'

const RankItem = memo(
  ({
    rank,
    title,
    subtitle,
    value,
    valueLabel,
  }: {
    rank: number
    title: string
    subtitle: string
    value: string
    valueLabel: string
  }) => {
    const theme = useTheme()
    const rankColor =
      rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#d97706' : 'rgba(128,128,128,0.25)'
    return (
      <View style={styles.rankItem}>
        <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
          <Text size={12} color="#fff" style={styles.rankBadgeText}>{rank}</Text>
        </View>
        <View style={styles.rankMain}>
          <Text size={14} color={theme['c-font']} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text size={11} color={theme['c-500']} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        <View style={styles.rankValue}>
          <Text size={14} color={theme['c-primary']} style={styles.rankValueText}>{value}</Text>
          <Text size={10} color={theme['c-500']}>{valueLabel}</Text>
        </View>
      </View>
    )
  }
)

const Stats = memo(() => {
  const theme = useTheme()
  const [overview, setOverview] = useState<LX.Stats.Overview>({ totalPlays: 0, totalDuration: 0, activeDays: 0 })
  const [topSongs, setTopSongs] = useState<LX.Stats.SongItem[]>([])
  const [topArtists, setTopArtists] = useState<Array<{ singer: string; plays: number; duration: number }>>([])
  const [selectedDate, setSelectedDate] = useState(getTodayText())

  const loadAll = useCallback(() => {
    void Promise.all([getStatsOverview(), getStatsTopSongs(10), getStatsTopArtists(10)]).then(
      ([overviewData, songs, artists]) => {
        setOverview(overviewData)
        setTopSongs(songs)
        setTopArtists(artists)
      }
    )
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    const handleStatsUpdated = () => loadAll()
    global.app_event.on('statsUpdated', handleStatsUpdated)
    return () => {
      global.app_event.off('statsUpdated', handleStatsUpdated)
    }
  }, [loadAll])

  const rankSongs = useMemo(
    () =>
      topSongs.map((item, index) => ({
        rank: index + 1,
        title: item.name,
        subtitle: item.singer,
        value: `${item.plays}`,
        valueLabel: '次',
      })),
    [topSongs]
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

        {/* 月度热力 */}
        <View style={styles.sectionHeader}>
          <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>月度热力</Text>
          <Text size={11} color={theme['c-500']}>长按格子可删除当天数据</Text>
        </View>
        <MonthHeatMap selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        {/* 年度总览 */}
        <View style={styles.sectionHeader}>
          <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>年度总览</Text>
        </View>
        <YearOverview />

        {/* 歌曲排行 */}
        <View style={styles.sectionHeader}>
          <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>歌曲排行</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
          {rankSongs.length === 0 ? (
            <Text size={12} color={theme['c-500']} style={styles.empty}>听歌后这里会出现你的年度最爱</Text>
          ) : (
            rankSongs.map((item) => <RankItem key={`song_${item.rank}`} {...item} />)
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

        {/* AI 报告 */}
        <AiReportSection />
      </ScrollView>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
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
  },
  rankBadgeText: {
    fontWeight: '800',
  },
  rankMain: {
    flex: 1,
    marginHorizontal: 10,
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
