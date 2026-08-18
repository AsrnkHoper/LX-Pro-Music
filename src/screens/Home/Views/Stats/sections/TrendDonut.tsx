import { memo, useMemo } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { calcEffectiveRatio, calcSourceDist, calcTrendCompare, type StatsPageData, type TimeRange } from '../aggregate'
import { DonutChart, TrendChart } from '../charts'

interface Props {
  data: StatsPageData
  range: TimeRange
}

const SOURCE_COLORS: Record<string, string> = {
  Search: '#7c4dff',
  Rec: '#ff9d5c',
  Detail: '#ff5e7a',
  List: '#2bd9c4',
}
const SOURCE_NAMES: Record<string, string> = {
  Search: '搜索',
  Rec: '推荐',
  Detail: '详情',
  List: '歌单',
}

const TrendDonutSection = memo(({ data, range }: Props) => {
  const theme = useTheme()
  const trend = useMemo(() => calcTrendCompare(data.daily, range), [data.daily, range])
  const ratio = useMemo(() => {
    const r = calcEffectiveRatio(data.events, range)
    const total = r.effective + r.ineffective
    return total > 0 ? r.effective / total : 0
  }, [data.events, range])
  const source = useMemo(() => calcSourceDist(data.history, range), [data.history, range])
  const topSource = source[0] ? { name: SOURCE_NAMES[source[0].source] ?? source[0].source, ratio: source[0].ratio } : { name: '暂无', ratio: 0 }

  return (
    <View style={[styles.section, { backgroundColor: theme['c-content-background'] }]}>
      <Text size={17} color={theme['c-font']} style={styles.title}>趋势 · 质量 · 来源</Text>
      <Text size={12} color={theme['c-500']} style={styles.subTitle}>时长趋势（本期实线 vs 上期虚线）</Text>
      <TrendChart current={trend.current} previous={trend.previous} width={320} height={120} />
      <View style={styles.donutRow}>
        <View style={styles.donutCol}>
          <DonutChart ratio={ratio} label="有效收听率" color="#ff9d5c" />
          <Text size={11} color={theme['c-500']} numberOfLines={1} style={styles.donutNote}>有效 {Math.round(ratio * 100)}%</Text>
        </View>
        <View style={styles.donutCol}>
          <DonutChart ratio={topSource.ratio} label={`来源 · ${topSource.name}`} color="#7c4dff" />
          <Text size={11} color={theme['c-500']} numberOfLines={1} style={styles.donutNote}>最高 {topSource.name} {Math.round(topSource.ratio * 100)}%</Text>
        </View>
      </View>
      <View style={styles.legend}>
        {source.map(item => (
          <Text key={item.source} size={10} color={theme['c-500']} numberOfLines={1} style={styles.legendItem}>
            <Text style={{ color: SOURCE_COLORS[item.source] ?? '#fff' }}>●</Text> {SOURCE_NAMES[item.source] ?? item.source} {Math.round(item.ratio * 100)}%
          </Text>
        ))}
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
  donutRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  donutCol: {
    flex: 1,
    alignItems: 'center',
  },
  donutNote: {
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 10,
  },
  legendItem: {
    marginHorizontal: 6,
    marginTop: 2,
  },
})

export default TrendDonutSection
