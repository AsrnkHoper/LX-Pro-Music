/**
 * 听歌统计页 · SVG 图表组件
 *
 * 包含：雷达图 / 金字塔 / 柱状图 / 折线趋势 / 环形图 / 热力图。
 * 雷达图不使用 demo 中“塞进日历旁边的小方格”排版，改为独立宽幅展示，
 * 标签全部放在雷达外圈并允许换行/缩短，避免文字溢出。
 */
import { memo } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Stop,
} from 'react-native-svg'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { getHeatColor } from './utils'

const SUNSET = {
  amber: '#ffd9a8',
  orange: '#ff9d5c',
  pink: '#ff5e7a',
  violet: '#7c4dff',
  cyan: '#2bd9c4',
  text: 'rgba(255,245,232,0.7)',
  faint: 'rgba(255,220,180,0.12)',
}

/* ============ 雷达图 ============ */
export interface RadarData {
  axes: string[]
  values: number[]
}

export const RadarChart = memo(({ data, size = 240 }: { data: RadarData; size?: number }) => {
  const theme = useTheme()
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.32
  const labelR = size * 0.44
  const axes = data.axes
  const values = data.values
  const n = axes.length
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n

  const gridPoints = (ratio: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = angle(i)
      return `${cx + R * ratio * Math.cos(a)},${cy + R * ratio * Math.sin(a)}`
    }).join(' ')

  const dataPoints = values.map((v, i) => {
    const a = angle(i)
    const r = R * Math.max(0, Math.min(1, v))
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <View style={styles.radarWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#ffd9a8" stopOpacity="0.75" />
            <Stop offset="1" stopColor="#ff5e7a" stopOpacity="0.35" />
          </LinearGradient>
        </Defs>
        {[0.25, 0.5, 0.75, 1].map(ratio => (
          <Polygon
            key={ratio}
            points={gridPoints(ratio)}
            fill="none"
            stroke={SUNSET.faint}
            strokeWidth={1}
          />
        ))}
        {axes.map((_, i) => {
          const a = angle(i)
          return (
            <Line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + R * Math.cos(a)}
              y2={cy + R * Math.sin(a)}
              stroke={SUNSET.faint}
              strokeWidth={1}
            />
          )
        })}
        <Polygon points={dataPolygon} fill="url(#radarFill)" stroke={SUNSET.amber} strokeWidth={1.5} strokeLinejoin="round" />
        {dataPoints.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#fff2da" />
        ))}
      </Svg>
      <View style={styles.radarLabels}>
        {axes.map((axis, i) => {
          const a = angle(i)
          const posX = cx + labelR * Math.cos(a)
          const posY = cy + labelR * Math.sin(a)
          const labelWidth = size * 0.36
          // 用固定宽度 + 数值定位，确保文字不会超出画布边界
          let labelPos: { left: number; top: number; width: number }
          if (Math.cos(a) > 0.3) {
            // 右侧：从轴端点向右展开，并限制不超出画布右边界
            labelPos = { left: Math.min(posX + 4, size - labelWidth), top: posY - 8, width: labelWidth }
          } else if (Math.cos(a) < -0.3) {
            // 左侧：标签右缘贴近轴端点，并限制不超出画布左边界
            labelPos = { left: Math.max(0, posX - 4 - labelWidth), top: posY - 8, width: labelWidth }
          } else {
            labelPos = { left: Math.max(0, Math.min(size - labelWidth, posX - labelWidth / 2)), top: posY - 8, width: labelWidth }
          }
          const textAlign: 'left' | 'center' | 'right' = Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center'
          return (
            <Text
              key={axis}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              size={11}
              color={SUNSET.text}
              style={[styles.radarLabel, labelPos, { textAlign }]}
            >
              {axis}
            </Text>
          )
        })}
      </View>
      <Text size={11} color={theme['c-500']} style={styles.chartHint}>多样性 · 深夜 · 循环 · 完听 · 活跃 · 探索</Text>
    </View>
  )
})

/* ============ 歌曲金字塔 ============ */
export interface PyramidData {
  tier: string
  count: number
  plays: number
  sample?: string
  color: string
  widthPercent: number
}

export const PyramidChart = memo(({ data }: { data: PyramidData[] }) => {
  const theme = useTheme()
  if (!data.length) {
    return <Text size={13} color={theme['c-500']} style={styles.empty}>暂无歌曲数据</Text>
  }
  return (
    <View style={styles.pyramidWrap}>
      {data.map(item => (
        <View key={item.tier} style={[styles.pyramidRow, { width: item.widthPercent }]}>
          <Text numberOfLines={1} size={12} color="#1a0a14" style={styles.pyramidText}>
            {item.tier} · {item.count} 首 / {item.plays} 次
          </Text>
        </View>
      ))}
    </View>
  )
})

/* ============ 柱状图 ============ */
export const BarsChart = memo(({ data, color, height = 90 }: { data: number[]; color?: string; height?: number }) => {
  const theme = useTheme()
  const max = Math.max(1, ...data)
  const barColor = color ?? SUNSET.orange
  return (
    <View style={styles.barsWrap}>
      <View style={[styles.bars, { height }]}>
        {data.map((v, i) => {
          const h = v > 0 ? Math.max(4, (v / max) * 100) : 2
          const isPeak = v === max && v > 0
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: `${h}%`,
                  backgroundColor: isPeak ? SUNSET.amber : barColor,
                  opacity: v > 0 ? 0.55 + (v / max) * 0.45 : 0.18,
                },
              ]}
            />
          )
        })}
      </View>
    </View>
  )
})

/* ============ 趋势折线 ============ */
export const TrendChart = memo(({ current, previous, width = 320, height = 120 }: {
  current: number[]
  previous: number[]
  width?: number
  height?: number
}) => {
  const theme = useTheme()
  const pad = 10
  const max = Math.max(1, ...current, ...previous)
  const n = Math.max(2, current.length)
  const X = (i: number) => pad + (i * (width - pad * 2)) / (n - 1)
  const Y = (v: number) => height - pad - (v / max) * (height - pad * 2 - 10)
  const linePath = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const currentPath = linePath(current)
  const previousPath = linePath(previous)
  const areaPath = current.length > 1 ? `${currentPath} L${X(current.length - 1).toFixed(1)},${height - pad} L${X(0).toFixed(1)},${height - pad} Z` : ''
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={SUNSET.orange} stopOpacity="0.45" />
          <Stop offset="1" stopColor={SUNSET.pink} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {areaPath ? <Path d={areaPath} fill="url(#trendArea)" /> : null}
      {previousPath ? <Path d={previousPath} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} strokeDasharray="4 4" /> : null}
      {currentPath ? <Path d={currentPath} fill="none" stroke={SUNSET.amber} strokeWidth={2.5} strokeLinecap="round" /> : null}
      {current.map((v, i) => (
        <Circle key={i} cx={X(i)} cy={Y(v)} r={2.5} fill="#fff2da" />
      ))}
    </Svg>
  )
})

/* ============ 环形图 ============ */
export const DonutChart = memo(({ ratio, label, color = '#ff9d5c', size = 110, children }: {
  ratio: number
  label: string
  color?: string
  size?: number
  children?: React.ReactNode
}) => {
  const theme = useTheme()
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  const dash = Math.max(0, Math.min(1, ratio || 0)) * c
  return (
    <View style={styles.donutWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.donutCenter}>
        {children ?? <Text size={18} color={theme['c-font']}>{Math.round(ratio * 100)}%</Text>}
        <Text size={10} color={theme['c-500']} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  )
})

/* ============ 热力图 ============ */
export interface HeatCell {
  date: string
  duration: number
  isCurrentMonth: boolean
  day: number
}

export const MonthHeatGrid = memo(({ cells, maxDuration, selectedDate, onSelect, onLongPress, todayText }: {
  cells: HeatCell[]
  maxDuration: number
  selectedDate: string | null
  onSelect: (date: string) => void
  onLongPress: (date: string) => void
  todayText: string
}) => {
  const theme = useTheme()
  return (
    <View style={styles.heatGrid}>
      {cells.map(cell => {
        const isSelected = selectedDate === cell.date
        const isToday = todayText === cell.date
        const isFuture = cell.date > todayText
        return (
          <TouchableOpacity
            key={cell.date}
            style={[
              styles.heatCell,
              {
                backgroundColor: cell.duration > 0 ? getHeatColor(cell.duration, maxDuration) : 'rgba(255,255,255,0.03)',
                opacity: cell.isCurrentMonth ? 1 : 0.32,
                borderColor: isSelected ? SUNSET.orange : 'transparent',
              },
            ]}
            disabled={isFuture}
            onPress={() => onSelect(cell.date)}
            onLongPress={() => onLongPress(cell.date)}
            delayLongPress={500}
          >
            <Text
              size={10}
              color={isSelected ? theme['c-primary'] : isToday ? theme['c-primary'] : cell.duration > 0 ? theme['c-font'] : theme['c-500']}
              style={isToday ? styles.todayText : undefined}
            >
              {cell.day}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
})

export const YearHeatGrid = memo(({ data, maxDuration, width }: { data: Array<{ date: string; duration: number }>; maxDuration: number; width: number }) => {
  const cell = 11
  const gap = 3
  const columns = 53
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.yearHeatGrid, { width: columns * (cell + gap) + gap }]}>
        {data.map((item, i) => (
          <View
            key={item.date || i}
            style={{
              width: cell,
              height: cell,
              margin: gap / 2,
              borderRadius: 2,
              backgroundColor: item.duration > 0 ? getHeatColor(item.duration, maxDuration) : 'rgba(255,255,255,0.04)',
            }}
          />
        ))}
      </View>
    </ScrollView>
  )
})

const styles = createStyle({
  radarWrap: {
    alignItems: 'center',
  },
  radarLabels: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  radarLabel: {
    position: 'absolute',
  },
  chartHint: {
    textAlign: 'center',
    marginTop: 4,
  },
  pyramidWrap: {
    gap: 8,
    alignItems: 'center',
  },
  pyramidRow: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  pyramidText: {
    textAlign: 'center',
  },
  barsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    flex: 1,
    minWidth: 2,
    borderRadius: 3,
  },
  donutWrap: {
    alignItems: 'center',
  },
  donutCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  heatCell: {
    width: '14.28%',
    aspectRatio: 1.15,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearHeatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  todayText: {
    textDecorationLine: 'underline',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 16,
  },
})
