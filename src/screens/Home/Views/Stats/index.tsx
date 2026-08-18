import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { getStatsDaily, getStatsEvents, getStatsSong } from '@/core/player/stats'
import { getPlayHistory } from '@/utils/data'
import type { StatsPageData, TimeRange } from './aggregate'
import OverviewSection from './sections/Overview'
import RadarPyramidSection from './sections/RadarPyramid'
import HeatmapSection from './sections/Heatmap'
import TimeDistSection from './sections/TimeDist'
import TrendDonutSection from './sections/TrendDonut'
import RankingsSection from './sections/Rankings'
import AiReportSection from './sections/AiReport'
import RecentEventsSection from './sections/RecentEvents'
import BackupSection from './sections/Backup'

const RANGES: { id: TimeRange; label: string }[] = [
  { id: 'week', label: '周' },
  { id: 'month', label: '月' },
  { id: 'year', label: '年' },
  { id: 'all', label: '全部' },
]

const Stats = memo(() => {
  const theme = useTheme()
  const [range, setRange] = useState<TimeRange>('month')
  const [pageData, setPageData] = useState<StatsPageData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    try {
      const [daily, song, events, history] = await Promise.all([
        getStatsDaily(),
        getStatsSong(),
        getStatsEvents(),
        getPlayHistory(),
      ])
      setPageData({ daily, song, events, history })
    } catch (err) {
      console.warn('load stats failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
    const handleUpdate = () => {
      setLoading(true)
      void loadAll()
    }
    global.app_event.on('statsUpdated', handleUpdate)
    global.app_event.on('playHistoryUpdated', handleUpdate)
    return () => {
      global.app_event.off('statsUpdated', handleUpdate)
      global.app_event.off('playHistoryUpdated', handleUpdate)
    }
  }, [loadAll])

  const sections = useMemo(() => {
    if (!pageData) return null
    const data = pageData
    return [
      <OverviewSection key="overview" data={data} range={range} />,
      <RadarPyramidSection key="radar" data={data} range={range} />,
      <HeatmapSection key="heatmap" data={data} />,
      <TimeDistSection key="time" data={data} range={range} />,
      <TrendDonutSection key="trend" data={data} range={range} />,
      <RankingsSection key="rank" data={data} range={range} />,
      <AiReportSection key="ai" />,
      <RecentEventsSection key="recent" data={data} />,
      <BackupSection key="backup" />,
    ]
  }, [pageData, range])

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 顶部自然过渡：不放突兀的标题栏，只保留低调范围切换 */}
        <View style={styles.hero}>
          <Text size={15} color={theme['c-primary']} style={styles.brand}>小琥珀 · 听歌志</Text>
          <Text size={10} color={theme['c-500']} style={styles.sub}>本地账本，不联网</Text>
        </View>
        <View style={styles.rangePill}>
          {RANGES.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.rangeBtn, range === item.id && styles.rangeBtnActive]}
              onPress={() => setRange(item.id)}
            >
              <Text size={12} color={range === item.id ? '#1a0a14' : theme['c-500']}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {loading && !pageData ? (
          <View style={styles.loading}>
            <Text size={14} color={theme['c-500']}>正在读取听歌账本…</Text>
          </View>
        ) : sections}
      </ScrollView>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  hero: {
    paddingTop: 18,
    paddingBottom: 6,
    paddingHorizontal: 4,
  },
  brand: {
    fontWeight: 'bold',
  },
  sub: {
    marginTop: 2,
  },
  rangePill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 999,
    padding: 3,
    backgroundColor: 'rgba(128,128,128,0.12)',
    marginVertical: 12,
  },
  rangeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  rangeBtnActive: {
    backgroundColor: '#ffb347',
  },
  loading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
})

export default Stats
