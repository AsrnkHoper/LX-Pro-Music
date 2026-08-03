import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import MonthHeatMap from './MonthHeatMap'
import YearOverview from './YearOverview'
import { getStatsOverview, getStatsTopSongs, getStatsTopArtists, getStatsDailyByDay } from '@/core/player/stats'
import { formatDuration, getTodayText } from './utils'

/**
 * 听歌统计页(本地事实层,不依赖 AI)
 * 概览 / 排行榜(歌曲·歌手) / 月度热力图 / 年度总览
 */
export default memo(() => {
  const theme = useTheme()
  const [overview, setOverview] = useState<LX.Stats.Overview>({ totalPlays: 0, totalDuration: 0, activeDays: 0 })
  const [topSongs, setTopSongs] = useState<LX.Stats.SongItem[]>([])
  const [topArtists, setTopArtists] = useState<Array<{ singer: string; plays: number; duration: number }>>([])
  const [selectedDate, setSelectedDate] = useState<string>(getTodayText())
  const [selectedDayDuration, setSelectedDayDuration] = useState(0)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      getStatsOverview(),
      getStatsTopSongs(10),
      getStatsTopArtists(10),
    ]).then(([overviewData, songs, artists]) => {
      if (cancelled) return
      setOverview(overviewData)
      setTopSongs(songs)
      setTopArtists(artists)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 统计更新后刷新概览
  useEffect(() => {
    const handleUpdate = () => {
      void Promise.all([getStatsOverview(), getStatsTopSongs(10), getStatsTopArtists(10)]).then(([overviewData, songs, artists]) => {
        setOverview(overviewData)
        setTopSongs(songs)
        setTopArtists(artists)
      })
    }
    global.app_event.on('playHistoryUpdated', handleUpdate)
    return () => {
      global.app_event.off('playHistoryUpdated', handleUpdate)
    }
  }, [])

  // 选中日期变化时刷新当天时长
  useEffect(() => {
    if (!selectedDate) return
    void getStatsDailyByDay(selectedDate).then(day => {
      setSelectedDayDuration(day?.duration ?? 0)
    })
  }, [selectedDate])

  const handleSelectDate = useCallback((dateText: string) => {
    setSelectedDate(dateText)
  }, [])

  const rankItems = useMemo(() => {
    const top = topSongs.slice(0, 10)
    return top.map((item, index) => ({
      rank: index + 1,
      name: item.name,
      singer: item.singer,
      plays: item.plays,
      duration: item.duration,
    }))
  }, [topSongs])

  const artistItems = useMemo(() => {
    const top = topArtists.slice(0, 10)
    return top.map((item, index) => ({
      rank: index + 1,
      name: item.singer,
      singer: '',
      plays: item.plays,
      duration: item.duration,
    }))
  }, [topArtists])

  const renderRankList = (items: Array<{ rank: number; name: string; singer: string; plays: number }>) => (
    <View style={styles.rankList}>
      {items.length === 0 ? (
        <Text size={13} color={theme['c-500']} style={styles.emptyTip}>暂无数据,听歌后自动统计</Text>
      ) : (
        items.map(item => (
          <View key={`${item.name}_${item.rank}`} style={styles.rankItem}>
            <Text
              size={14}
              color={item.rank <= 3 ? theme['c-primary'] : theme['c-font']}
              style={styles.rankNum}
            >
              {item.rank}
            </Text>
            <View style={styles.rankMain}>
              <Text size={14} color={theme['c-font']} numberOfLines={1}>{item.name}</Text>
              {item.singer ? <Text size={12} color={theme['c-500']} numberOfLines={1}>{item.singer}</Text> : null}
            </View>
            <Text size={12} color={theme['c-500']}>{item.plays} 次</Text>
          </View>
        ))
      )}
    </View>
  )

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* 概览 */}
        <View style={styles.overview}>
          <View style={[styles.overviewItem, { borderRightColor: theme['c-border-background'] }]}>
            <Text size={22} color={theme['c-primary']}>{overview.totalPlays}</Text>
            <Text size={12} color={theme['c-500']}>播放次数</Text>
          </View>
          <View style={[styles.overviewItem, { borderRightColor: theme['c-border-background'] }]}>
            <Text size={22} color={theme['c-primary']}>{formatDuration(overview.totalDuration)}</Text>
            <Text size={12} color={theme['c-500']}>累计时长</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text size={22} color={theme['c-primary']}>{overview.activeDays}</Text>
            <Text size={12} color={theme['c-500']}>活跃天数</Text>
          </View>
        </View>

        {/* 月度热力图 */}
        <View style={styles.section}>
          <Text size={15} color={theme['c-font']} style={styles.sectionTitle}>月度热力图</Text>
          <MonthHeatMap selectedDate={selectedDate} onSelectDate={handleSelectDate} />
          <Text size={12} color={theme['c-500']} style={styles.hint}>
            点击格子查看当天账本,长按删除当天数据
          </Text>
        </View>

        {/* 年度总览 */}
        <View style={styles.section}>
          <YearOverview />
        </View>

        {/* 排行榜 */}
        <View style={styles.section}>
          <Text size={15} color={theme['c-font']} style={styles.sectionTitle}>歌曲排行</Text>
          {renderRankList(rankItems)}
        </View>
        <View style={styles.section}>
          <Text size={15} color={theme['c-font']} style={styles.sectionTitle}>歌手排行</Text>
          {renderRankList(artistItems)}
        </View>
      </ScrollView>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  overview: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 0.5,
  },
  section: {
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
    paddingVertical: 8,
  },
  hint: {
    textAlign: 'center',
    paddingTop: 4,
  },
  emptyTip: {
    textAlign: 'center',
    paddingVertical: 16,
  },
  rankList: {
    paddingBottom: 4,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  rankNum: {
    width: 28,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  rankMain: {
    flex: 1,
    marginRight: 8,
  },
})
