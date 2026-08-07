import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { getStatsDailyByRange } from '@/core/player/stats'
import { formatDuration } from './utils'

/**
 * 年度总览(MVP 版:12 个月时长条形总览)
 * - 公历 12 月自动展示(农历正月判断需农历算法,后续版本补)
 * - 平时手动开关查看
 * 数据源:每日聚合(永久),不受播放历史 31 天限制
 */
const YearOverview = memo(() => {
  const theme = useTheme()
  const now = useMemo(() => new Date(), [])
  const [isVisible, setIsVisible] = useState(now.getMonth() === 11) // 公历 12 月自动展示
  const [monthDurations, setMonthDurations] = useState<number[]>([])

  const loadYear = useCallback(() => {
    const year = new Date().getFullYear()
    const start = new Date(year, 0, 1).getTime()
    const end = new Date(year + 1, 0, 1).getTime() - 1
    void getStatsDailyByRange(start, end).then((daily) => {
      const durations = new Array(12).fill(0) as number[]
      for (const item of daily) {
        const m = Number(item.date.slice(5, 7)) - 1
        if (m >= 0 && m < 12) durations[m] += item.duration
      }
      setMonthDurations(durations)
    })
  }, [])

  useEffect(() => {
    if (isVisible) loadYear()
  }, [isVisible, loadYear])

  // 满色基准 = 全年听歌最多的那个月(动态,避免固定24h导致全年都是浅色)
  const maxDuration = useMemo(() => Math.max(1, ...monthDurations), [monthDurations])

  const toggle = useCallback(() => {
    setIsVisible(prev => !prev)
  }, [])

  if (!isVisible) {
    return (
      <TouchableOpacity style={styles.toggleBtn} onPress={toggle}>
        <Text size={14} color={theme['c-primary']}>查看年度总览</Text>
      </TouchableOpacity>
    )
  }

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const currentYear = new Date().getFullYear()

  return (
    <View>
      <View style={styles.yearHeader}>
        <Text size={15} color={theme['c-font']} style={styles.yearTitle}>{currentYear} 年度总览</Text>
        <TouchableOpacity style={styles.toggleBtn} onPress={toggle}>
          <Text size={13} color={theme['c-primary']}>收起</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.monthList}>
        {monthNames.map((name, index) => {
          const duration = monthDurations[index] ?? 0
          const ratio = duration > 0 ? Math.max(0.04, duration / maxDuration) : 0
          return (
            <View key={name} style={styles.monthRow}>
              <Text size={12} color={theme['c-500']} style={styles.monthLabel}>{name}</Text>
              <View style={styles.barTrack}>
                <View
                  style={{
                    ...styles.barFill,
                    width: `${ratio * 100}%`,
                    backgroundColor: duration > 0 ? theme['c-primary'] : 'transparent',
                  }}
                />
              </View>
              <Text size={12} color={theme['c-500']} style={styles.monthValue}>
                {duration > 0 ? formatDuration(duration) : '—'}
              </Text>
            </View>
          )
        })}
      </View>
      <Text size={12} color={theme['c-500']} style={styles.hint}>
        每格深浅 = 当月听歌时长(全年最多一个月=最深)
      </Text>
    </View>
  )
})

const styles = createStyle({
  toggleBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yearTitle: {
    fontWeight: 'bold',
    paddingVertical: 8,
  },
  monthList: {
    paddingVertical: 4,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  monthLabel: {
    width: 36,
  },
  barTrack: {
    flex: 1,
    height: 14,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.15)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  monthValue: {
    width: 84,
    textAlign: 'right',
  },
  hint: {
    textAlign: 'center',
    paddingTop: 6,
  },
})

export default YearOverview
