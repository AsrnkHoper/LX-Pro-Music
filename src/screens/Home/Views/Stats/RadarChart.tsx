import { memo, useMemo } from 'react'
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg'
import { useTheme } from '@/store/theme/hook'

interface Props {
  data: { label: string; value: number }[]
  size?: number
}

const MAX_VALUE = 1

const point = (cx: number, cy: number, radius: number, angle: number) => ({
  x: cx + radius * Math.cos(angle),
  y: cy + radius * Math.sin(angle),
})

const RadarChart = memo(({ data, size = 220 }: Props) => {
  const theme = useTheme()
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.34

  const angleFor = (index: number) => -Math.PI / 2 + (index * 2 * Math.PI) / data.length

  const valuePoints = useMemo(() => {
    return data.map((item, index) => {
      const angle = angleFor(index)
      const r = Math.max(0, Math.min(1, item.value)) * radius
      return point(cx, cy, r, angle)
    })
  }, [data, radius])

  const gridPolygons = [0.25, 0.5, 0.75, 1].map((level) =>
    data.map((_, index) => {
      const angle = angleFor(index)
      const r = level * radius
      const p = point(cx, cy, r, angle)
      return `${p.x},${p.y}`
    }).join(' ')
  )

  return (
    <Svg width={size} height={size}>
      {gridPolygons.map((points, index) => (
        <Polygon
          key={index}
          points={points}
          fill="none"
          stroke={theme['c-500']}
          strokeWidth={0.5}
          opacity={0.4}
        />
      ))}
      {data.map((_, index) => {
        const angle = angleFor(index)
        const outer = point(cx, cy, radius, angle)
        return (
          <Line
            key={index}
            x1={cx}
            y1={cy}
            x2={outer.x}
            y2={outer.y}
            stroke={theme['c-500']}
            strokeWidth={0.5}
            opacity={0.4}
          />
        )
      })}
      <Polygon
        points={valuePoints.map((p) => `${p.x},${p.y}`).join(' ')}
        fill={theme['c-primary-alpha-500']}
        stroke={theme['c-primary']}
        strokeWidth={1.5}
      />
      {valuePoints.map((p, index) => (
        <Circle key={index} cx={p.x} cy={p.y} r={2.5} fill={theme['c-primary']} />
      ))}
      {data.map((item, index) => {
        const angle = angleFor(index)
        const labelPos = point(cx, cy, radius + 18, angle)
        return (
          <SvgText
            key={index}
            x={labelPos.x}
            y={labelPos.y}
            fontSize={10}
            fill={theme['c-font']}
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {item.label}
          </SvgText>
        )
      })}
    </Svg>
  )
})

export default RadarChart
