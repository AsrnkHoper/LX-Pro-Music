import { memo, useMemo } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { calcDailyAvg, calcStreak, calcTrendCompare, filterDailyByRange, type StatsPageData, type TimeRange } from '../aggregate'
import { formatDuration } from '../utils'

interface Props {
  data: StatsPageData
  range: TimeRange
}

const OverviewSection = memo(({ data, range }: Props) => {
  const theme = useTheme()
  const daily = useMemo(() => filterDailyByRange(data.daily, range), [data.daily, range])
  const overview = useMemo(() => {
    let totalPlays = 0
    let totalDuration = 0
    let activeDays = 0
    for (const item of daily) {
      totalPlays += item.plays
      totalDuration += item.duration
      if (item.active) activeDays++
    }
    return { totalPlays, totalDuration, activeDays }
  }, [daily])

  const streak = useMemo(() => calcStreak(data.daily), [data.daily])
  const avg = useMemo(() => calcDailyAvg(data.daily, range), [data.daily, range])
  const trend = useMemo(() => calcTrendCompare(data.daily, range), [data.daily, range])
  const durationText = useMemo(() => {
    if (overview.totalDuration < 60) return `${overview.totalDuration}s`
    const h = Math.floor(overview.totalDuration / 3600)
    const m = Math.floor((overview.totalDuration % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }, [overview.totalDuration])

  const deltaColor = trend.deltaPct >= 0 ? '#ffb347' : '#7ec8ff'
  const deltaText = `${trend.deltaPct > 0 ? '+' : ''}${trend.deltaPct}%`

  return (
    <View style={[styles.section, { backgroundColor: theme['c-content-background'] }]}>
      <Text size={17} color={theme['c-font']} style={styles.title}>概览</Text>
      <View style={styles.bigRow}>
        <View style={styles.bigCol}>
          <Text size={28} color={theme['c-primary']} numberOfLines={1} adjustsFontSizeToFit>{overview.totalPlays}</Text>
          <Text size={11} color={theme['c-500']} numberOfLines={1}>播放次数</Text>
        </View>
        <View style={styles.bigCol}>
          <Text size={28} color={theme['c-primary']} numberOfLines={1} adjustsFontSizeToFit>{durationText}</Text>
          <Text size={11} color={theme['c-500']} numberOfLines={1}>累计时长</Text>
        </View>
        <View style={styles.bigCol}>
          <Text size={28} color={theme['c-primary']} numberOfLines={1} adjustsFontSizeToFit>{overview.activeDays}</Text>
          <Text size={11} color={theme['c-500']} numberOfLines={1}>活跃天数</Text>
        </View>
      </View>
      <View style={styles.subRow}>
        <View style={styles.subCol}>
          <Text size={15} color={theme['c-font']} numberOfLines={1}>🔥 {streak.current}</Text>
          <Text size={10} color={theme['c-500']} numberOfLines={1}>连续天数</Text>
        </View>
        <View style={styles.subCol}>
          <Text size={15} color={theme['c-font']} numberOfLines={1}>{streak.max}</Text>
          <Text size={10} color={theme['c-500']} numberOfLines={1}>最长连续</Text>
        </View>
        <View style={styles.subCol}>
          <Text size={15} color={theme['c-font']} numberOfLines={1} adjustsFontSizeToFit>{formatDuration(avg)}</Text>
          <Text size={10} color={theme['c-500']} numberOfLines={1}>日均时长</Text>
        </View>
        <View style={styles.subCol}>
          <Text size={15} color={deltaColor} numberOfLines={1}>{deltaText}</Text>
          <Text size={10} color={theme['c-500']} numberOfLines={1}>较上期</Text>
        </View>
      </View>
    </View>
  )
})

const styles = createStyle({
  section: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 12,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  bigRow: {
    flexDirection: 'row',
  },
  bigCol: {
    flex: 1,
    alignItems: 'center',
  },
  subRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 6,
  },
  subCol: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
})

export default OverviewSection
