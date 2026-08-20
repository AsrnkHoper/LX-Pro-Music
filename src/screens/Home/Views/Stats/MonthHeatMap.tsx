import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import Badge from '@/components/common/Badge'
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
import { playOnlineList } from '@/core/list'

interface Props {
  selectedDate: string
  onSelectDate: (date: string) => void
  showDetail: boolean
  onToggleDetail: () => void
}

const DAY = 24 * 60 * 60 * 1000

const MonthHeatMap = memo(({ selectedDate, onSelectDate, showDetail, onToggleDetail }: Props) => {
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

  const handlePlayAll = () => {
    if (!dayEvents.length) return
    const list = dayEvents.map((event) => event.musicInfo as LX.Music.MusicInfoOnline)
    void playOnlineList('stats_day', list, 0)
  }

  const handleRandomPlay = () => {
    if (!dayEvents.length) return
    const list = dayEvents.map((event) => event.musicInfo as LX.Music.MusicInfoOnline)
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    void playOnlineList('stats_day_random', list, 0)
  }

  const renderDayEvents = () => {
    if (!selectedDate) return null
    if (!dayEvents.length) {
      return (
        <Text size={12} color={theme['c-500']} style={styles.emptyEvents}>
          这一天还没有有效收听记录
        </Text>
      )
    }
    return dayEvents.map((event, index) => {
      const info = event.musicInfo
      const qualitys = (info as LX.Music.MusicInfoOnline).meta?._qualitys
      const quality = qualitys && Object.keys(qualitys).find((q) => qualitys[q as LX.Quality])
      return (
        <TouchableOpacity
          key={event.id || `${event.playedAt}_${index}`}
          style={styles.eventRow}
          onPress={() => addTempPlayListAndPlay([{ listId: null, musicInfo: info }])}
        >
          {showDetail ? (
            <>
              <Image
                url={(info.meta as any)?.picUrl}
                style={styles.eventCover}
              />
              <View style={styles.eventMain}>
                <View style={styles.eventTitleRow}>
                  <Text size={13} color={theme['c-font']} numberOfLines={1} style={styles.eventName}>
                    {info.name}
                  </Text>
                  <Badge type="tertiary">{info.source?.toUpperCase?.()}</Badge>
                  {quality ? <Badge type="hq">{quality}</Badge> : null}
                </View>
                <Text size={11} color={theme['c-500']} numberOfLines={1}>
                  {info.singer} · {(info.meta as any)?.albumName || ''}
                </Text>
                <Text size={11} color={theme['c-500']} numberOfLines={1}>
                  {formatDurationFull(event.playTime)} · {info.interval || ''}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.eventIndex}>
                <Text size={11} color={theme['c-500']}>{index + 1}</Text>
              </View>
              <View style={styles.eventMain}>
                <Text size={13} color={theme['c-font']} numberOfLines={1}>
                  {info.name}
                </Text>
                <Text size={11} color={theme['c-500']} numberOfLines={1}>
                  {info.singer}
                </Text>
              </View>
              <Text size={11} color={theme['c-primary']}>
                {formatDurationFull(event.playTime)}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )
    })
  }

  return (
    <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
      <View style={styles.cardHeader}>
        <TouchableOpacity style={styles.yearBtn} onPress={() => changeMonthBy(-12)}>
          <Text size={16} color={theme['c-font']}>«</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.monthBtn} onPress={() => changeMonthBy(-1)}>
          <Text size={20} color={theme['c-font']}>‹</Text>
        </TouchableOpacity>
        <Text size={16} color={theme['c-font']} style={styles.monthTitle}>{monthText}</Text>
        <TouchableOpacity style={styles.monthBtn} disabled={!canGoNext} onPress={() => changeMonthBy(1)}>
          <Text size={20} color={canGoNext ? theme['c-font'] : theme['c-300']}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.yearBtn} disabled={!canGoNext} onPress={() => changeMonthBy(12)}>
          <Text size={16} color={canGoNext ? theme['c-font'] : theme['c-300']}>»</Text>
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
                color={isSelected ? (duration > 0 ? '#fff' : theme['c-primary']) : duration > 0 ? '#fff' : theme['c-500']}
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
          <View style={styles.selectedHeaderRight}>
            <Text size={12} color={theme['c-500']}>
              {selectedDuration > 0 ? formatDurationFull(selectedDuration) : '暂无记录'}
            </Text>
            <TouchableOpacity onPress={onToggleDetail} style={styles.detailToggle}>
              <Text size={11} color={theme['c-primary']}>{showDetail ? '简洁' : '详细'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {dayEvents.length > 0 ? (
          <View style={styles.dayActions}>
            <TouchableOpacity style={styles.dayActionBtn} onPress={handlePlayAll}>
              <Text size={12} color={theme['c-primary']}>播放全部</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dayActionBtn} onPress={handleRandomPlay}>
              <Text size={12} color={theme['c-primary']}>随机播放</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {dayEvents.length > 0 ? (
          <ScrollView style={styles.dayEventScroll} nestedScrollEnabled>
            {renderDayEvents()}
          </ScrollView>
        ) : (
          renderDayEvents()
        )}
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
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearBtn: {
    width: 32,
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
  selectedHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  dayActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(77,175,124,0.12)',
  },
  detailToggle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(77,175,124,0.12)',
  },
  selectedDate: {
    fontWeight: '700',
  },
  emptyEvents: {
    textAlign: 'center',
    paddingVertical: 8,
  },
  dayEventScroll: {
    maxHeight: 300,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  eventCover: {
    width: 42,
    height: 42,
    borderRadius: 8,
    marginRight: 10,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventName: {
    flexShrink: 1,
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
