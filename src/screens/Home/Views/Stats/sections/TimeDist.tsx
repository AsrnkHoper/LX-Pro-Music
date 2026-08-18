import { memo, useMemo } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { calcHourlyDist, calcWeekdayDist, filterByRange, type StatsPageData, type TimeRange } from '../aggregate'
import { BarsChart } from '../charts'

interface Props {
  data: StatsPageData
  range: TimeRange
}

const HOUR_LABELS = ['0', '6', '12', '18', '23']
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const TimeDistSection = memo(({ data, range }: Props) => {
  const theme = useTheme()
  const hours = useMemo(() => calcHourlyDist(data.events, range), [data.events, range])
  const week = useMemo(() => calcWeekdayDist(data.daily, range), [data.daily, range])
  const lateNightRatio = useMemo(() => {
    let late = 0
    let total = 0
    for (const e of filterByRange(data.events, range)) {
      total += e.playTime
      const h = new Date(e.playedAt).getHours()
      if (h >= 23 || h < 5) late += e.playTime
    }
    return total > 0 ? Math.round((late / total) * 100) : 0
  }, [data.events, range])

  return (
    <View style={[styles.section, { backgroundColor: theme['c-content-background'] }]}>
      <Text size={17} color={theme['c-font']} style={styles.title}>时间分布</Text>
      <Text size={12} color={theme['c-500']} style={styles.subTitle}>24 小时</Text>
      <BarsChart data={hours} color="#ff9d5c" height={90} />
      <View style={styles.labels}>
        {HOUR_LABELS.map(label => <Text key={label} size={9} color={theme['c-500']} style={styles.label}>{label}</Text>)}
      </View>
      <Text size={11} color={theme['c-500']} style={styles.tip}>深夜 23–5 点占比 {lateNightRatio}%</Text>

      <Text size={12} color={theme['c-500']} style={[styles.subTitle, styles.weekTitle]}>星期</Text>
      <BarsChart data={week} color="#7c4dff" height={70} />
      <View style={styles.labels}>
        {WEEK_LABELS.map(label => <Text key={label} size={9} color={theme['c-500']} style={styles.label}>{label}</Text>)}
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
  subTitle: {
    marginBottom: 6,
  },
  weekTitle: {
    marginTop: 14,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  label: {
    textAlign: 'center',
    flex: 1,
  },
  tip: {
    textAlign: 'center',
    marginTop: 6,
  },
})

export default TimeDistSection
