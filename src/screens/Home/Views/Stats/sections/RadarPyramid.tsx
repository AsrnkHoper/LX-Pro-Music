import { memo, useMemo } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { calcPyramidTiers, calcRadarProfile, type StatsPageData, type TimeRange } from '../aggregate'
import { RadarChart, type PyramidData } from '../charts'

interface Props {
  data: StatsPageData
  range: TimeRange
}

const PYRAMID_COLORS = [
  'linear-gradient(95deg,#ffe6a0,#ffb347)',
  'linear-gradient(95deg,#ffb98a,#ff7a5c)',
  'linear-gradient(95deg,#c98ad6,#9b5cd6)',
  'linear-gradient(95deg,#5a6db0,#3a4a8a)',
]

const RadarPyramidSection = memo(({ data, range }: Props) => {
  const theme = useTheme()
  const radar = useMemo(() => calcRadarProfile(data.song, data.events, data.daily, range), [data.song, data.events, data.daily, range])
  const tiers = useMemo(() => calcPyramidTiers(data.song, range), [data.song, range])

  const pyramidData: PyramidData[] = useMemo(() => {
    const widths = [100, 84, 66, 48]
    return tiers.map((t, i) => ({
      ...t,
      color: PYRAMID_COLORS[i] ?? '#888',
      widthPercent: widths[i] ?? 40,
    }))
  }, [tiers])

  return (
    <View style={[styles.section, { backgroundColor: theme['c-content-background'] }]}>
      <Text size={17} color={theme['c-font']} style={styles.title}>听歌画像</Text>
      {/* 雷达图独立宽幅展示，避免 demo 中塞小格导致标签溢出 */}
      <RadarChart data={{ axes: ['多样性', '深夜', '循环', '完听', '活跃', '探索'], values: [radar.diversity, radar.lateNight, radar.repeat, radar.completion, radar.activity, radar.discovery] }} />
      <View style={styles.divider} />
      <Text size={14} color={theme['c-font']} style={styles.subTitle}>歌曲金字塔</Text>
      <View style={styles.pyramidRows}>
        {pyramidData.map(item => (
          <View key={item.tier} style={[styles.pyramidRow, { width: `${item.widthPercent}%` }]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} size={12} color="#1a0a14" style={styles.pyramidRowText}>
              {item.tier} · {item.count} 首 / {item.plays} 次
            </Text>
          </View>
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
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.15)',
    marginVertical: 14,
  },
  pyramidRows: {
    alignItems: 'center',
    gap: 8,
  },
  pyramidRow: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  pyramidRowText: {
    textAlign: 'center',
  },
})

export default RadarPyramidSection
