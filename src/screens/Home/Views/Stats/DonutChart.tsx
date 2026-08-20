import { memo, useMemo } from 'react'
import { View } from 'react-native'
import Svg, { Path, Text as SvgText } from 'react-native-svg'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { formatDurationFull } from './utils'

interface Props {
  data: { label: string; value: number }[]
  size?: number
  colors?: string[]
}

const DEFAULT_COLORS = ['#4daf7c', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#64748b']

const polar = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle),
})

const DonutChart = memo(({ data, size = 180, colors = DEFAULT_COLORS }: Props) => {
  const theme = useTheme()
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.32
  const total = useMemo(() => Math.max(1, data.reduce((sum, item) => sum + item.value, 0)), [data])

  const segments = useMemo(() => {
    let startAngle = -Math.PI / 2
    return data
      .filter((item) => item.value > 0)
      .map((item, index) => {
        const angle = (item.value / total) * Math.PI * 2
        const start = polar(cx, cy, r, startAngle)
        const end = polar(cx, cy, r, startAngle + angle)
        const largeArc = angle > Math.PI ? 1 : 0
        startAngle += angle
        return {
          ...item,
          d: `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
          color: colors[index % colors.length],
          percent: Math.round((item.value / total) * 100),
        }
      })
  }, [data, total, cx, cy, r, colors])

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        {segments.map((seg, index) => (
          <Path
            key={index}
            d={seg.d}
            fill="none"
            stroke={seg.color}
            strokeWidth={size * 0.14}
            strokeLinecap="round"
          />
        ))}
        <SvgText x={cx} y={cy - 4} fontSize={18} fill={theme['c-font']} textAnchor="middle" fontWeight="bold">
          {formatDurationFull(total)}
        </SvgText>
        <SvgText x={cx} y={cy + 14} fontSize={10} fill={theme['c-500']} textAnchor="middle">
          累计时长
        </SvgText>
      </Svg>
      <View style={styles.legend}>
        {segments.map((seg, index) => (
          <View key={index} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <Text size={11} color={theme['c-font']} numberOfLines={1} style={styles.legendLabel}>
              {seg.label}
            </Text>
            <Text size={11} color={theme['c-500']}>{seg.percent}%</Text>
          </View>
        ))}
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  legend: {
    flex: 1,
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
  },
})

export default DonutChart
