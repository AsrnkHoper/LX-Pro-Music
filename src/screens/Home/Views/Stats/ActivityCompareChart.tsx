import { memo, useMemo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

interface Props {
  mode: 'month' | 'year'
  current: number[]
  previous: number[]
  currentLabel: string
  previousLabel: string
  onToggleMode: () => void
}

const W = 320
const H = 180
const PAD = 28

const pointFor = (index: number, value: number, length: number, maxY: number) => {
  const x = PAD + (index / Math.max(1, length - 1)) * (W - PAD * 2)
  const y = H - PAD - (Math.min(1, value / maxY)) * (H - PAD * 2)
  return { x, y }
}

const ActivityCompareChart = memo(({ mode, current, previous, currentLabel, previousLabel, onToggleMode }: Props) => {
  const theme = useTheme()
  const maxY = useMemo(() => Math.max(1, ...current, ...previous), [current, previous])
  const currentPoints = useMemo(
    () => current.map((value, index) => pointFor(index, value, current.length, maxY)).map((p) => `${p.x},${p.y}`).join(' '),
    [current, maxY]
  )
  const previousPoints = useMemo(
    () => previous.map((value, index) => pointFor(index, value, previous.length, maxY)).map((p) => `${p.x},${p.y}`).join(' '),
    [previous, maxY]
  )
  const compactDuration = (seconds: number) => {
    const totalMinutes = Math.floor(seconds / 60)
    if (totalMinutes < 60) return `${totalMinutes}m`
    return `${Math.floor(totalMinutes / 60)}h`
  }
  const yTicks = [0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: H - PAD - ratio * (H - PAD * 2),
    label: compactDuration(Math.round(maxY * ratio)),
  }))

  return (
    <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
      <View style={styles.header}>
        <View>
          <Text size={15} color={theme['c-font']} style={styles.title}>活跃时长对比</Text>
          <Text size={11} color={theme['c-500']}>
            {mode === 'month' ? '本月 vs 上月(每日)' : '今年 vs 去年(每月)'}
          </Text>
        </View>
        <TouchableOpacity onPress={onToggleMode} style={styles.toggleBtn}>
          <Text size={11} color={theme['c-primary']}>{mode === 'month' ? '看年对比' : '看月对比'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: theme['c-primary'] }]} />
          <Text size={11} color={theme['c-500']}>{currentLabel}(实线)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: theme['c-500'], opacity: 0.7 }]} />
          <Text size={11} color={theme['c-500']}>{previousLabel}(虚线)</Text>
        </View>
      </View>

      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {yTicks.map((tick, index) => (
          <Line key={index} x1={PAD} y1={tick.y} x2={W - PAD} y2={tick.y} stroke={theme['c-500']} strokeWidth={0.5} opacity={0.4} />
        ))}
        {yTicks.map((tick, index) => (
          <SvgText key={`t${index}`} x={PAD - 4} y={tick.y + 3} fontSize={8} fill={theme['c-500']} textAnchor="end">
            {tick.label}
          </SvgText>
        ))}
        <Polyline points={previousPoints} fill="none" stroke={theme['c-500']} strokeWidth={1.5} strokeDasharray="6 4" opacity={0.7} />
        <Polyline points={currentPoints} fill="none" stroke={theme['c-primary']} strokeWidth={2} />
      </Svg>
    </View>
  )
})

const styles = createStyle({
  card: {
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontWeight: '700',
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(77,175,124,0.12)',
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendLine: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
})

export default ActivityCompareChart
