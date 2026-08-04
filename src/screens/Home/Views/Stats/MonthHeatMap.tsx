import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View, FlatList } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import {
  changeMonth,
  formatDuration,
  formatDurationFull,
  getHeatColor,
  hasHeatData,
  getMonthDays,
  getTodayText,
  MAX_HEAT_SECONDS,
  parseDateText,
  toDateText,
  toMonthText,
  WEEK_LABELS,
  type MonthDay,
} from './utils'
import { getStatsDailyByRange, getStatsDailyByDay, getStatsEventsByDay, deleteStatsDay } from '@/core/player/stats'

interface DayHeat {
  date: string
  duration: number
}

interface Props {
  /** 当前选中的日期文本(YYYY-MM-DD),受控 */
  selectedDate: string
  /** 选中日期变化回调 */
  onSelectDate: (dateText: string) => void
}

const DAY = 24 * 60 * 60 * 1000

const MonthHeatMap = memo(({ selectedDate, onSelectDate }: Props) => {
  const theme = useTheme()
  const todayText = getTodayText()
  const [viewMonth, setViewMonth] = useState<Date>(() => parseDateText(selectedDate) ?? new Date())
  const [heatMap, setHeatMap] = useState<Map<string, number>>(new Map())
  const [dayEvents, setDayEvents] = useState<LX.Stats.EventItem[]>([])

  const monthText = toMonthText(viewMonth)

  // 加载当月每日聚合
  useEffect(() => {
    const start = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getTime()
    const end = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1).getTime() - 1
    let cancelled = false
    void getStatsDailyByRange(start, end).then((daily) => {
      if (cancelled) return
      const map = new Map<string, number>()
      for (const item of daily) map.set(item.date, item.duration)
      setHeatMap(map)
    })
    return () => {
      cancelled = true
    }
  }, [viewMonth])

  // 加载选中当天账本
  useEffect(() => {
    if (!selectedDate) return
    let cancelled = false
    void getStatsEventsByDay(selectedDate).then((events) => {
      if (!cancelled) setDayEvents(events)
    })
    return () => {
      cancelled = true
    }
  }, [selectedDate, heatMap])

  const changeMonthBy = useCallback((offset: number) => {
    setViewMonth(prev => changeMonth(prev, offset))
  }, [])

  const monthDays = useMemo(() => getMonthDays(viewMonth), [viewMonth])

  const selectedDuration = useMemo(() => {
    if (!selectedDate) return 0
    return heatMap.get(selectedDate) ?? 0
  }, [heatMap, selectedDate])

  const canGoNext = useMemo(() => {
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return viewMonth.getTime() < currentMonthStart.getTime()
  }, [viewMonth])

  const handlePressDay = useCallback((dateText: string) => {
    if (dateText > todayText) return
    onSelectDate(dateText)
  }, [onSelectDate, todayText])

  const handleLongPressDay = useCallback((dateText: string) => {
    if (dateText > todayText) return
    toast('删除确认：长按删除当天数据')
    // 简化处理:直接删除(策划文档:长按格子可删除当天数据)
    void deleteStatsDay(dateText).then(() => {
      setHeatMap(prev => {
        const next = new Map(prev)
        next.delete(dateText)
        return next
      })
      setDayEvents([])
      toast('已删除当天统计')
    })
  }, [])

  return (
    <View style={styles.container}>
      {/* 月份切换 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => changeMonthBy(-1)}>
          <Icon name="chevron-left" size={18} color={theme['c-font']} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthText}</Text>
        <TouchableOpacity style={styles.iconBtn} disabled={!canGoNext} onPress={() => changeMonthBy(1)}>
          <Icon name="chevron-right" size={18} color={canGoNext ? theme['c-font'] : theme['c-300']} />
        </TouchableOpacity>
      </View>

      {/* 选中日信息 */}
      <View style={styles.selectedInfo}>
        <Text size={15} color={theme['c-font']}>
          {selectedDate ? `${selectedDate} · ${formatDuration(selectedDuration)}` : '点击格子查看当天'}
        </Text>
      </View>

      {/* 周标签 */}
      <View style={styles.weekRow}>
        {WEEK_LABELS.map(day => (
          <Text key={day} style={styles.weekText} color={theme['c-500']}>{day}</Text>
        ))}
      </View>

      {/* 格子 */}
      <View style={styles.grid}>
        {monthDays.map(({ date, dateText, isCurrentMonth }: MonthDay) => {
          const duration = heatMap.get(dateText) ?? 0
          const isToday = dateText === todayText
          const isSelected = dateText === selectedDate
          const isFuture = dateText > todayText
          return (
            <TouchableOpacity
              key={dateText}
              style={{
                ...styles.dayCell,
                backgroundColor: getHeatColor(duration),
                borderColor: isSelected ? theme['c-primary'] : 'transparent',
                borderWidth: isSelected ? 1 : 0,
                opacity: isCurrentMonth ? 1 : 0.35,
              }}
              disabled={isFuture}
              onPress={() => handlePressDay(dateText)}
              onLongPress={() => handleLongPressDay(dateText)}
              delayLongPress={500}
            >
              <Text
                size={13}
                color={
                  isFuture
                    ? theme['c-300']
                    : isSelected
                      ? theme['c-primary']
                      : hasHeatData(duration)
                        ? theme['c-font']
                        : theme['c-500']
                }
                style={isToday ? styles.todayText : undefined}
              >
                {date.getDate().toString()}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* 色阶图例 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll}>
        <View style={styles.legendRow}>
          <Text size={12} color={theme['c-500']}>少</Text>
          {Array.from({ length: 12 }, (_, i) => {
            const seconds = ((i + 0.5) / 12) * MAX_HEAT_SECONDS
            return (
              <View
                key={i}
                style={{ ...styles.legendCell, backgroundColor: getHeatColor(seconds) }}
              />
            )
          })}
          <Text size={12} color={theme['c-500']}>多</Text>
          <Text size={12} color={theme['c-300']} style={styles.legendHint}>(满色阶=24小时)</Text>
        </View>
      </ScrollView>

      {/* 当天账本 */}
      {selectedDate ? (
        <View style={styles.dayList}>
          <Text size={14} color={theme['c-font']} style={styles.dayListTitle}>
            {selectedDate} 账本({dayEvents.length} 次)
          </Text>
          <ScrollView style={styles.dayListScroll} nestedScrollEnabled>
            {dayEvents.length === 0 ? (
              <Text size={13} color={theme['c-500']} style={styles.emptyTip}>当天暂无播放记录</Text>
            ) : (
              dayEvents.map(event => (
                <View key={event.id} style={styles.dayListItem}>
                  <View style={styles.dayListItemMain}>
                    <Text size={13} color={theme['c-font']} numberOfLines={1}>{event.musicInfo.name}</Text>
                    <Text size={12} color={theme['c-500']} numberOfLines={1}>{event.musicInfo.singer}</Text>
                  </View>
                  <Text size={12} color={theme['c-500']}>{formatDurationFull(event.playTime)}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  )
})

const styles = createStyle({
  container: {
    paddingHorizontal: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  iconBtn: {
    padding: 8,
  },
  monthTitle: {
    minWidth: 120,
    textAlign: 'center',
  },
  selectedInfo: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginBottom: 2,
  },
  todayText: {
    textDecorationLine: 'underline',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingRight: 10,
  },
  legendScroll: {
    flexGrow: 0,
  },
  legendCell: {
    width: 14,
    height: 14,
    marginHorizontal: 2,
    borderRadius: 3,
  },
  legendHint: {
    marginLeft: 6,
  },
  dayList: {
    marginTop: 4,
    paddingHorizontal: 4,
  },
  dayListTitle: {
    paddingVertical: 6,
  },
  dayListScroll: {
    height: 220,
  },
  emptyTip: {
    paddingVertical: 10,
    textAlign: 'center',
  },
  dayListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  dayListItemMain: {
    flex: 1,
    marginRight: 8,
  },
})

export default MonthHeatMap
