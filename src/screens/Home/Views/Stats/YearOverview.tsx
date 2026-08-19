import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { getStatsDailyByRange, getStatsOverview } from '@/core/player/stats'
import { formatDurationFull } from './utils'

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

/**
 * 年度总览:12 个月时长条 + 年度合计
 */
const YearOverview = memo(() => {
  const theme = useTheme()
  const year = new Date().getFullYear()
  const [monthDurations, setMonthDurations] = useState<number[]>(new Array(12).fill(0))
  const [yearOverview, setYearOverview] = useState<LX.Stats.Overview>({ totalPlays: 0, totalDuration: 0, activeDays: 0 })

  const loadYear = useCallback(() => {
    const start = new Date(year, 0, 1).getTime()
    const end = new Date(year + 1, 0, 1).getTime() - 1
    void getStatsDailyByRange(start, end).then((daily) => {
      const durations = new Array(12).fill(0)
      for (const item of daily) {
        const month = Number(item.date.slice(5, 7)) - 1
        if (month >= 0 && month < 12) durations[month] += item.duration
      }
      setMonthDurations(durations)
    })
    void getStatsOverview(start, end).then(setYearOverview)
  }, [year])

  useEffect(() => {
    loadYear()
  }, [loadYear])

  useEffect(() => {
    const handleStatsUpdated = () => loadYear()
    global.app_event.on('statsUpdated', handleStatsUpdated)
    return () => {
      global.app_event.off('statsUpdated', handleStatsUpdated)
    }
  }, [loadYear])

  const maxMonthDuration = useMemo(() => Math.max(1, ...monthDurations), [monthDurations])

  return (
    <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
      <View style={styles.header}>
        <View>
          <Text size={16} color={theme['c-font']} style={styles.title}>{year} 年</Text>
          <Text size={11} color={theme['c-500']}>全年累计 {formatDurationFull(yearOverview.totalDuration)} · {yearOverview.totalPlays} 次有效收听</Text>
        </View>
        <View style={styles.activeDaysChip}>
          <Text size={11} color={theme['c-primary']}>{yearOverview.activeDays} 天活跃</Text>
        </View>
      </View>

      <View style={styles.bars}>
        {monthDurations.map((duration, index) => {
          const ratio = duration / maxMonthDuration
          const isCurrentMonth = index === new Date().getMonth()
          return (
            <View key={index} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${Math.max(4, Math.round(ratio * 100))}%`,
                      backgroundColor: isCurrentMonth ? theme['c-primary'] : theme['c-primary-alpha-500'],
                    },
                  ]}
                />
              </View>
              <Text size={9} color={isCurrentMonth ? theme['c-primary'] : theme['c-500']} style={styles.barLabel}>
                {MONTH_NAMES[index]}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
})

const styles = createStyle({
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontWeight: '700',
  },
  activeDaysChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(77,175,124,0.12)',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barTrack: {
    width: 12,
    height: 90,
    borderRadius: 6,
    backgroundColor: 'rgba(128,128,128,0.12)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barLabel: {
    textAlign: 'center',
  },
})

export default YearOverview
