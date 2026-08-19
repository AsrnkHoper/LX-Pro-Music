import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import { useTheme } from '@/store/theme/hook'
import { useWindowSize } from '@/utils/hooks'
import { createStyle, toast } from '@/utils/tools'
import {
  changeMonth,
  formatDurationFull,
  getHeatColor,
  getMonthDays,
  getTodayText,
  parseDateText,
  toDateText,
  toMonthText,
  WEEK_LABELS,
} from './utils'
import {
  deleteStatsDay,
  getStatsDailyByRange,
  getStatsEventsByDay,
} from '@/core/player/stats'
import { addTempPlayListAndPlay } from '@/core/player/tempPlayList'

interface Props {
  selectedDate: string
  onSelectDate: (date: string) => void
}

const DAY = 24 * 60 * 60 * 1000

const MonthHeatMap = memo(({ selectedDate, onSelectDate }: Props) => {
  const theme = useTheme()
  const { width: windowWidth } = useWindowSize()
  const todayText = getTodayText()
  const [viewMonth, setViewMonth] = useState(() => parseDateText(selectedDate) ?? new Date())
  const [heatMap, setHeatMap] = useState<Map<string, number>>(new Map())
  const [maxMonthDuration, setMaxMonthDuration] = useState(0)
  const [dayEvents, setDayEvents] = useState<LX.Stats.EventItem[]>([])
  const [pendingDeleteDate, setPendingDeleteDate] = useState<string | null>(null)
  const deleteConfirmRef = useRef<ConfirmAlertType>(null)

  const pagePadding = 16
  const cardPadding = 16
  const gap = 6
  const cellSize = Math.floor((windowWidth - pagePadding * 2 - cardPadding * 2 - gap * 6) / 7)

  const monthText = toMonthText(viewMonth)

  const loadMonth = useCallback(() => {
    const start = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getTime()
    const end = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1).getTime() - 1
    void getStatsDailyByRange(start, end).then((daily) => {
      const map = new Map<string, number>()
      let max = 0
      for (const item of daily) {
        map.set(item.date, item.duration)
        if (item.duration > max) max = item.duration
      }
      setHeatMap(map)
      setMaxMonthDuration(max)
    })
  }, [viewMonth])

  useEffect(() => {
    loadMonth()
  }, [loadMonth])

  useEffect(() => {
    const handleStatsUpdated = () => loadMonth()
    global.app_event.on('statsUpdated', handleStatsUpdated)
    return () => {
      global.app_event.off('statsUpdated', handleStatsUpdated)
    }
  }, [loadMonth])

  useEffect(() => {
    if (!selectedDate) return
    void getStatsEventsByDay(selectedDate).then(setDayEvents)
  }, [selectedDate, heatMap])

  const changeMonthBy = useCallback((offset: number) => {
    setViewMonth((prev) => changeMonth(prev, offset))
  }, [])

  const monthDays = useMemo(() => getMonthDays(viewMonth), [viewMonth])

  const selectedDuration = heatMap.get(selectedDate) ?? 0

  const canGoNext = useMemo(() => {
    const now = new Date()
    return viewMonth.getTime() < new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  }, [viewMonth])

  const handlePressDay = useCallback(
    (dateText: string) => {
      if (dateText > todayText) return
      onSelectDate(dateText)
    },
    [onSelectDate, todayText]
  )

  const handleLongPressDay = useCallback(
    (dateText: string) => {
      if (dateText > todayText || !heatMap.has(dateText)) return
      setPendingDeleteDate(dateText)
      deleteConfirmRef.current?.setVisible(true)
    },
    [heatMap, todayText]
  )

  const handleConfirmDelete = useCallback(() => {
    const dateText = pendingDeleteDate
    if (!dateText) return
    void deleteStatsDay(dateText)
      .then(() => {
        deleteConfirmRef.current?.setVisible(false)
        setPendingDeleteDate(null)
        setHeatMap((prev) => {
          const next = new Map(prev)
          next.delete(dateText)
          return next
        })
        setDayEvents([])
        toast('已删除当天统计')
      })
      .catch(() => {
        deleteConfirmRef.current?.setVisible(false)
        setPendingDeleteDate(null)
        toast('删除失败')
      })
  }, [pendingDeleteDate])

  const renderDayEvents = () => {
    if (!selectedDate) return null
    if (!dayEvents.length) {
      return (
        <Text size={12} color={theme['c-500']} style={styles.emptyEvents}>
          这一天还没有有效收听记录
        </Text>
      )
    }
    return dayEvents.slice(0, 8).map((event, index) => (
      <TouchableOpacity
        key={event.id || `${event.playedAt}_${index}`}
        style={styles.eventRow}
        onPress={() => addTempPlayListAndPlay([{ listId: null, musicInfo: event.musicInfo }])}
      >
        <View style={styles.eventIndex}>
          <Text size={11} color={theme['c-500']}>{index + 1}</Text>
        </View>
        <View style={styles.eventMain}>
          <Text size={13} color={theme['c-font']} numberOfLines={1}>
            {event.musicInfo.name}
          </Text>
          <Text size={11} color={theme['c-500']} numberOfLines={1}>
            {event.musicInfo.singer}
          </Text>
        </View>
        <Text size={11} color={theme['c-primary']}>
          {formatDurationFull(event.playTime)}
        </Text>
      </TouchableOpacity>
    ))
  }

  return (
    <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
      <View style={styles.cardHeader}>
        <TouchableOpacity style={styles.monthBtn} onPress={() => changeMonthBy(-1)}>
          <Text size={20} color={theme['c-font']}>‹</Text>
        </TouchableOpacity>
        <Text size={16} color={theme['c-font']} style={styles.monthTitle}>{monthText}</Text>
        <TouchableOpacity style={styles.monthBtn} disabled={!canGoNext} onPress={() => changeMonthBy(1)}>
          <Text size={20} color={canGoNext ? theme['c-font'] : theme['c-300']}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEK_LABELS.map((label) => (
          <Text key={label} size={11} color={theme['c-500']} style={styles.weekLabel}>{label}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {monthDays.map(({ date, dateText, isCurrentMonth }) => {
          const duration = heatMap.get(dateText) ?? 0
          const isToday = dateText === todayText
          const isSelected = dateText === selectedDate
          const isFuture = dateText > todayText
          return (
            <TouchableOpacity
              key={dateText}
              activeOpacity={0.7}
              disabled={isFuture}
              onPress={() => handlePressDay(dateText)}
              onLongPress={() => handleLongPressDay(dateText)}
              delayLongPress={500}
              style={[
                styles.dayCell,
                {
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: getHeatColor(duration, maxMonthDuration),
                  borderColor: isSelected ? theme['c-primary'] : 'transparent',
                  borderWidth: isSelected ? 2 : 0,
                  opacity: isFuture ? 0.35 : isCurrentMonth ? 1 : 0.4,
                },
              ]}
            >
              <Text
                size={13}
                color={isSelected ? theme['c-primary'] : duration > 0 ? '#fff' : theme['c-500']}
                style={isToday ? styles.todayText : null}
              >
                {date.getDate()}
              </Text>
              {isToday ? <View style={[styles.todayDot, { backgroundColor: theme['c-primary'] }]} /> : null}
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={styles.legendRow}>
        <Text size={10} color={theme['c-500']}>少</Text>
        {Array.from({ length: 12 }, (_, i) => (
          <View
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: getHeatColor(((i + 0.5) / 12) * Math.max(maxMonthDuration, 1), maxMonthDuration),
            }}
          />
        ))}
        <Text size={10} color={theme['c-500']}>多</Text>
      </View>

      <View style={[styles.selectedPanel, { backgroundColor: theme['c-primary-alpha-900'] }]}>
        <View style={styles.selectedHeader}>
          <Text size={14} color={theme['c-primary']} style={styles.selectedDate}>
            {selectedDate || '选择日期'}
          </Text>
          <Text size={12} color={theme['c-500']}>
            {selectedDuration > 0 ? formatDurationFull(selectedDuration) : '暂无记录'}
          </Text>
        </View>
        {renderDayEvents()}
      </View>

      <ConfirmAlert
        ref={deleteConfirmRef}
        title="删除当天统计"
        text={`确定删除 ${pendingDeleteDate ?? ''} 的听歌统计吗?此操作不可恢复。`}
        cancelText="取消"
        confirmText="删除"
        bgHide={false}
        onConfirm={handleConfirmDelete}
      />
    </View>
  )
})

const styles = createStyle({
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthBtn: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayCell: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  todayText: {
    fontWeight: '800',
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
  },
  selectedPanel: {
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  selectedDate: {
    fontWeight: '700',
  },
  emptyEvents: {
    textAlign: 'center',
    paddingVertical: 8,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  eventIndex: {
    width: 22,
    alignItems: 'center',
  },
  eventMain: {
    flex: 1,
    marginHorizontal: 8,
  },
})

export default MonthHeatMap
