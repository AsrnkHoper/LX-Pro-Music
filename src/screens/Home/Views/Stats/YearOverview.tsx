import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { getStatsDailyByRange } from '@/core/player/stats'
import { formatDuration, getHeatColor, getMonthDays, getTodayText, WEEK_LABELS } from './utils'

/** 单个月份卡片(带入场动画:淡入 + 上移) */
const MonthCard = memo((props: {
  monthName: string
  monthDate: Date
  dayDurations: Map<string, number>
  maxDayDuration: number
  todayText: string
  visible: boolean
}) => {
  const theme = useTheme()
  const { monthName, monthDate, dayDurations, maxDayDuration, todayText, visible } = props
  const anim = useRef(new Animated.Value(0)).current

  // 该月可见时播放:opacity 0→1, translateY 12→0
  useEffect(() => {
    if (!visible) return
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [visible, anim])

  const monthDays = useMemo(() => getMonthDays(monthDate), [monthDate])

  return (
    <Animated.View
      style={[
        styles.monthCard,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      <Text size={13} color={theme['c-font']} style={styles.monthCardTitle}>{monthName}</Text>
      <View style={styles.monthWeekRow}>
        {WEEK_LABELS.map(day => (
          <Text key={day} size={9} color={theme['c-500']} style={styles.monthWeekText}>{day}</Text>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {monthDays.map(({ dateText, isCurrentMonth }) => {
          const duration = dayDurations.get(dateText) ?? 0
          const isToday = dateText === todayText
          return (
            <View
              key={dateText}
              style={{
                ...styles.yearDayCell,
                backgroundColor: isCurrentMonth ? getHeatColor(duration, maxDayDuration) : 'transparent',
              }}
            >
              <Text
                size={9}
                color={
                  !isCurrentMonth
                    ? theme['c-300']
                    : isToday
                      ? theme['c-primary']
                      : duration > 0
                        ? theme['c-font']
                        : theme['c-500']
                }
                style={isToday ? styles.todayText : undefined}
              >
                {dateText.slice(8, 10).replace(/^0/, '')}
              </Text>
            </View>
          )
        })}
      </View>
    </Animated.View>
  )
})

/**
 * 年度总览
 * - 视图① 月时长条形总览(默认):12 个月条,全年最多月=最深
 * - 视图② 年度热力图:4 行×3 列真实月历,每天一格,
 *   渲染色阶取"全年听歌最多的那天"为最深色,其它日按比例递减
 * 数据源:每日聚合(永久)
 */
const YearOverview = memo(() => {
  const theme = useTheme()
  const now = useMemo(() => new Date(), [])
  const [isVisible, setIsVisible] = useState(now.getMonth() === 11) // 公历 12 月自动展示
  const [viewMode, setViewMode] = useState<'bar' | 'heat'>('bar')
  const [monthDurations, setMonthDurations] = useState<number[]>([])
  const [dayDurations, setDayDurations] = useState<Map<string, number>>(new Map())
  // 年度热力图分批渲染:一次性渲染 12×42=504 格会卡顿,逐月递增渲染
  const [visibleMonths, setVisibleMonths] = useState(0)

  const loadYear = useCallback(() => {
    const year = new Date().getFullYear()
    const start = new Date(year, 0, 1).getTime()
    const end = new Date(year + 1, 0, 1).getTime() - 1
    void getStatsDailyByRange(start, end).then((daily) => {
      const durations = new Array(12).fill(0) as number[]
      const dayMap = new Map<string, number>()
      for (const item of daily) {
        const m = Number(item.date.slice(5, 7)) - 1
        if (m >= 0 && m < 12) durations[m] += item.duration
        dayMap.set(item.date, item.duration)
      }
      setMonthDurations(durations)
      setDayDurations(dayMap)
    })
  }, [])

  useEffect(() => {
    if (isVisible) loadYear()
  }, [isVisible, loadYear])

  // 切到热力图视图时,分帧逐月渲染(每 120ms 显示 1 个月,配合 MonthCard 入场动画,平滑逐月浮现)
  useEffect(() => {
    if (viewMode !== 'heat') return
    setVisibleMonths(0)
    const timer = setInterval(() => {
      setVisibleMonths(prev => {
        if (prev >= 12) {
          clearInterval(timer)
          return 12
        }
        return prev + 1
      })
    }, 120)
    return () => clearInterval(timer)
  }, [viewMode, isVisible])

  // 条形视图满色基准 = 全年听歌最多的月
  const maxMonthDuration = useMemo(() => Math.max(1, ...monthDurations), [monthDurations])
  // 热力图满色基准 = 全年听歌最多的那天(琥珀要求:最高日为最深色,其它日递减)
  const maxDayDuration = useMemo(() => Math.max(1, ...Array.from(dayDurations.values())), [dayDurations])

  const toggle = useCallback(() => {
    setIsVisible(prev => !prev)
  }, [])

  const switchView = useCallback((mode: 'bar' | 'heat') => {
    setViewMode(mode)
  }, [])

  // ⚠️ hooks 必须在所有条件 return 之前调用(React 规则,否则 "Rendered more hooks")
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const currentYear = new Date().getFullYear()
  const todayText = getTodayText()
  const monthDates = useMemo(
    () => monthNames.map((_, index) => new Date(currentYear, index, 1)),
    [currentYear, monthNames],
  )

  if (!isVisible) {
    return (
      <TouchableOpacity style={styles.toggleBtn} onPress={toggle}>
        <Text size={14} color={theme['c-primary']}>查看年度总览</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View>
      <View style={styles.yearHeader}>
        <Text size={15} color={theme['c-font']} style={styles.yearTitle}>{currentYear} 年度总览</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.viewSwitchBtn, viewMode === 'bar' && styles.viewSwitchBtnActive]}
            onPress={() => switchView('bar')}
          >
            <Text size={12} color={viewMode === 'bar' ? theme['c-primary'] : theme['c-500']}>条形</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewSwitchBtn, viewMode === 'heat' && styles.viewSwitchBtnActive]}
            onPress={() => switchView('heat')}
          >
            <Text size={12} color={viewMode === 'heat' ? theme['c-primary'] : theme['c-500']}>热力图</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleBtnInline} onPress={toggle}>
            <Text size={13} color={theme['c-primary']}>收起</Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'bar' ? (
        <View style={styles.monthList}>
          {monthNames.map((name, index) => {
            const duration = monthDurations[index] ?? 0
            const ratio = duration > 0 ? Math.max(0.04, duration / maxMonthDuration) : 0
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
          <Text size={12} color={theme['c-500']} style={styles.hint}>
            每格深浅 = 当月听歌时长(全年最多一个月=最深)
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.yearGrid}>
            {monthDates.map((monthDate, index) => {
              // 分批渲染 + 平滑入场动画:只渲染 visibleMonths 之前的部分
              if (index >= visibleMonths) return null
              return (
                <MonthCard
                  key={monthNames[index]}
                  monthName={monthNames[index]}
                  monthDate={monthDate}
                  dayDurations={dayDurations}
                  maxDayDuration={maxDayDuration}
                  todayText={todayText}
                  visible
                />
              )
            })}
          </View>
        </ScrollView>
      )}

      {viewMode === 'heat' ? (
        <Text size={12} color={theme['c-500']} style={styles.hint}>
          全年听歌最多的那天 = 最深色,其它天按比例递减
        </Text>
      ) : null}
    </View>
  )
})

const styles = createStyle({
  toggleBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleBtnInline: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewSwitchBtn: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginRight: 4,
  },
  viewSwitchBtnActive: {
    backgroundColor: 'rgba(128,128,128,0.15)',
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
  // 年度热力图
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 8,
    width: 350, // 4 列 × 每卡片约 84 宽
  },
  monthCard: {
    width: 84,
    margin: 2,
    padding: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(128,128,128,0.06)',
  },
  monthCardTitle: {
    fontWeight: 'bold',
    paddingBottom: 2,
  },
  monthWeekRow: {
    flexDirection: 'row',
  },
  monthWeekText: {
    flex: 1,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  yearDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  todayText: {
    textDecorationLine: 'underline',
    fontWeight: 'bold',
  },
})

export default YearOverview
