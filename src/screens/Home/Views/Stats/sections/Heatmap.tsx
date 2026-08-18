import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { play } from '@/core/player/player'
import { deleteStatsDay } from '@/core/player/stats'
import { formatDuration, formatDurationFull, getMonthDays, getTodayText, toDateText, WEEK_LABELS } from '../utils'
import { MonthHeatGrid, YearHeatGrid } from '../charts'
import type { StatsPageData } from '../aggregate'

interface Props {
  data: StatsPageData
}

const DAY = 24 * 60 * 60 * 1000

const HeatmapSection = memo(({ data }: Props) => {
  const theme = useTheme()
  const todayText = getTodayText()
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month')
  const [viewMonth, setViewMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(todayText)
  const [pendingDeleteDate, setPendingDeleteDate] = useState<string | null>(null)
  const deleteConfirmRef = useRef<ConfirmAlertType>(null)

  const dailyMap = useMemo(() => new Map(data.daily.map(item => [item.date, item.duration])), [data.daily])

  const monthDays = useMemo(() => getMonthDays(viewMonth), [viewMonth])
  const monthCells = useMemo(() => monthDays.map(({ date, dateText, isCurrentMonth }) => ({
    date: dateText,
    duration: dailyMap.get(dateText) ?? 0,
    isCurrentMonth,
    day: date.getDate(),
  })), [monthDays, dailyMap])
  const monthMax = useMemo(() => Math.max(1, ...monthCells.map(c => c.duration)), [monthCells])

  const year = viewMonth.getFullYear()
  const yearCells = useMemo(() => {
    const start = new Date(year, 0, 1)
    const offset = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - offset)
    const cells: Array<{ date: string; duration: number }> = []
    for (let i = 0; i < 53 * 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const key = toDateText(d)
      if (d.getFullYear() === year) {
        cells.push({ date: key, duration: dailyMap.get(key) ?? 0 })
      } else {
        cells.push({ date: '', duration: 0 })
      }
    }
    return cells
  }, [year, dailyMap])
  const yearMax = useMemo(() => Math.max(1, ...yearCells.map(c => c.duration)), [yearCells])

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return []
    const start = new Date(`${selectedDate}T00:00:00`).getTime()
    const end = start + DAY - 1
    return data.events.filter(e => e.playedAt >= start && e.playedAt <= end).sort((a, b) => b.playedAt - a.playedAt)
  }, [data.events, selectedDate])
  const selectedDuration = selectedDate ? dailyMap.get(selectedDate) ?? 0 : 0

  const changeMonth = useCallback((offset: number) => {
    setViewMonth(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + offset, 1)
      if (next.getTime() > Date.now()) return prev
      return next
    })
  }, [])

  const handleSelectDate = useCallback((date: string) => {
    if (date > todayText) return
    setSelectedDate(date)
  }, [todayText])

  const handleLongPressDate = useCallback((date: string) => {
    if (date > todayText) return
    setPendingDeleteDate(date)
    deleteConfirmRef.current?.setVisible(true)
  }, [todayText])

  const handleConfirmDelete = useCallback(() => {
    const date = pendingDeleteDate
    if (!date) return
    void deleteStatsDay(date)
      .then(() => {
        toast('已删除当天统计')
        deleteConfirmRef.current?.setVisible(false)
        setPendingDeleteDate(null)
      })
      .catch(() => {
        deleteConfirmRef.current?.setVisible(false)
        setPendingDeleteDate(null)
        toast('删除失败')
      })
  }, [pendingDeleteDate])

  const handlePlayEvent = useCallback((event: LX.Stats.EventItem) => {
    if (!event.musicInfo) return
    addTempPlayList([{ listId: null, musicInfo: event.musicInfo }])
    play()
  }, [])

  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const canPrevYear = year > 2000
  const canNextYear = viewMode === 'year'
    ? year < now.getFullYear()
    : new Date(year + 1, viewMonth.getMonth(), 1).getTime() <= currentMonthStart.getTime()
  const canPrevMonth = viewMonth.getTime() > new Date(2000, 0, 1).getTime()
  const canNextMonth = viewMonth.getFullYear() < now.getFullYear() || viewMonth.getMonth() < now.getMonth()

  return (
    <View style={[styles.section, { backgroundColor: theme['c-content-background'] }]}>
      <Text size={17} color={theme['c-font']} style={styles.title}>听歌日历</Text>
      <View style={styles.seg}>
        {(['month', 'year'] as const).map(mode => (
          <TouchableOpacity key={mode} style={[styles.segBtn, viewMode === mode && styles.segBtnActive]} onPress={() => setViewMode(mode)}>
            <Text size={12} color={viewMode === mode ? '#1a0a14' : theme['c-500']}>{mode === 'month' ? '月度' : '年度'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'month' ? (
        <>
          <View style={styles.head}>
            <TouchableOpacity style={styles.iconBtn} disabled={!canPrevMonth} onPress={() => changeMonth(-12)}>
              <Text color={canPrevMonth ? theme['c-font'] : theme['c-300']}>«</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} disabled={!canPrevMonth} onPress={() => changeMonth(-1)}>
              <Text color={canPrevMonth ? theme['c-font'] : theme['c-300']}>‹</Text>
            </TouchableOpacity>
            <Text size={15} color={theme['c-font']} style={styles.monthLabel} numberOfLines={1}>{viewMonth.getFullYear()}-{`${viewMonth.getMonth() + 1}`.padStart(2, '0')}</Text>
            <TouchableOpacity style={styles.iconBtn} disabled={!canNextMonth} onPress={() => changeMonth(1)}>
              <Text color={canNextMonth ? theme['c-font'] : theme['c-300']}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} disabled={!canNextYear} onPress={() => changeMonth(12)}>
              <Text color={canNextYear ? theme['c-font'] : theme['c-300']}>»</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.weekRow}>
            {WEEK_LABELS.map(day => <Text key={day} size={10} color={theme['c-500']} style={styles.weekLabel}>{day}</Text>)}
          </View>
          <MonthHeatGrid
            cells={monthCells}
            maxDuration={monthMax}
            selectedDate={selectedDate}
            onSelect={handleSelectDate}
            onLongPress={handleLongPressDate}
            todayText={todayText}
          />
        </>
      ) : (
        <>
          <View style={styles.head}>
            <TouchableOpacity style={styles.iconBtn} disabled={!canPrevYear} onPress={() => setViewMonth(new Date(year - 1, 0, 1))}>
              <Text color={canPrevYear ? theme['c-font'] : theme['c-300']}>‹</Text>
            </TouchableOpacity>
            <Text size={15} color={theme['c-font']} style={styles.monthLabel}>{year}</Text>
            <TouchableOpacity style={styles.iconBtn} disabled={!canNextYear} onPress={() => setViewMonth(new Date(year + 1, 0, 1))}>
              <Text color={canNextYear ? theme['c-font'] : theme['c-300']}>›</Text>
            </TouchableOpacity>
          </View>
          <YearHeatGrid data={yearCells} maxDuration={yearMax} width={360} />
        </>
      )}

      <View style={styles.dayDetail}>
        <Text size={13} color={theme['c-font']} numberOfLines={1}>
          {selectedDate ? `${selectedDate} · ${formatDuration(selectedDuration)}` : '点击日期查看当天'}
        </Text>
        <ScrollView style={styles.dayList} nestedScrollEnabled>
          {selectedDayEvents.length === 0 ? (
            <Text size={12} color={theme['c-500']} style={styles.emptyText}>当天暂无播放记录</Text>
          ) : selectedDayEvents.map(event => (
            <TouchableOpacity key={event.id} style={styles.eventRow} onPress={() => handlePlayEvent(event)}>
              <View style={styles.eventMain}>
                <Text size={13} color={theme['c-font']} numberOfLines={1}>{event.musicInfo?.name || '未知歌曲'}</Text>
                <Text size={11} color={theme['c-500']} numberOfLines={1}>{event.musicInfo?.singer || '未知歌手'}</Text>
              </View>
              <Text size={11} color={theme['c-500']} numberOfLines={1}>{formatDurationFull(event.playTime)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ConfirmAlert
        ref={deleteConfirmRef}
        title="删除当天统计"
        text={pendingDeleteDate ? `确定删除 ${pendingDeleteDate} 的听歌统计吗？不可恢复` : ''}
        cancelText="取消"
        confirmText="删除"
        bgHide={false}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteDate(null)}
      />
    </View>
  )
})

const styles = createStyle({
  section: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 12,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  seg: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 999,
    padding: 3,
    backgroundColor: 'rgba(128,128,128,0.12)',
    marginBottom: 10,
  },
  segBtn: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  segBtnActive: {
    backgroundColor: '#ffb347',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  monthLabel: {
    minWidth: 90,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  weekRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
  },
  dayDetail: {
    marginTop: 12,
    borderRadius: 16,
    padding: 10,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  dayList: {
    marginTop: 6,
    maxHeight: 180,
  },
  emptyText: {
    paddingVertical: 8,
    textAlign: 'center',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  eventMain: {
    flex: 1,
    marginRight: 8,
  },
})

export default HeatmapSection
