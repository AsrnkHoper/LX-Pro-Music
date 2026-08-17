import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import { useTheme } from '@/store/theme/hook'
import { createStyle, handleReadFile, handleSaveFile, toast } from '@/utils/tools'
import MonthHeatMap from './MonthHeatMap'
import YearOverview from './YearOverview'
import AiConfig from '../Setting/settings/Other/AiConfig'
import { exportStatsData, getStatsDailyByDay, getStatsOverview, getStatsTopArtists, getStatsTopSongs, importStatsData } from '@/core/player/stats'
import { getReportArchive, importReportArchive } from '@/core/stats/report'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { play } from '@/core/player/player'
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
  const [chooseVisible, setChooseVisible] = useState(false)
  const choosePathRef = useRef<ChoosePathType>(null)
  const chooseActionRef = useRef<'stats-export' | 'stats-import'>('stats-export')
  const importConfirmRef = useRef<ConfirmAlertType>(null)

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
    global.app_event.on('statsUpdated', handleUpdate)
    return () => {
      global.app_event.off('playHistoryUpdated', handleUpdate)
      global.app_event.off('statsUpdated', handleUpdate)
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

  const handlePlaySong = useCallback((songId: string) => {
    // 从 topSongs 中找到完整 musicInfo
    const song = topSongs.find((s) => s.id === songId)
    if (!song) return
    // 构造 musicInfo(需要包含 source 等字段才能播放;stats 中存的是摘要,实际播放需要完整 musicInfo)
    // 这里使用 song 的 id/name/singer 构造一个最小 musicInfo,实际可能无法播放(缺少 source 等)
    // 作为轻量实现,尝试通过 addTempPlayList 播放
    const musicInfo = {
      id: song.id,
      name: song.name,
      singer: song.singer,
      source: 'kw' as LX.OnlineSource, // 默认酷我,可能不准确
    } as LX.Music.MusicInfo
    addTempPlayList([{ listId: null, musicInfo }])
    play()
  }, [topSongs])

  const handleChooseConfirm = useCallback((path: string) => {
    const action = chooseActionRef.current
    if (action === 'stats-export') {
      void exportStatsData()
        .then((data) => getReportArchive().then((archive) => ({ ...data, archive })))
        .then((data) => handleSaveFile(`${path}/lx_stats.lxmc`, data))
        .then(() => toast('账本数据已导出(含报告档案)'))
        .catch((err: any) => toast(`导出失败:${err?.message ?? err}`, 'long'))
    } else {
      void handleReadFile<any>(path)
        .then((data) =>
          Promise.all([
            importStatsData(data),
            data.archive ? importReportArchive(data.archive) : Promise.resolve(),
          ])
        )
        .then(() => toast('账本数据已导入(含报告档案)'))
        .catch((err: any) => toast(`导入失败:${err?.message ?? err}`, 'long'))
    }
  }, [])

  const showChoose = useCallback(
    (action: 'stats-export' | 'stats-import') => {
      chooseActionRef.current = action
      const options: { title: string; dirOnly: boolean; filter?: string[] } = {
        title: action === 'stats-export' ? '选择账本导出目录' : '选择账本备份文件',
        dirOnly: action === 'stats-export',
      }
      if (action === 'stats-import') {
        options.filter = undefined // 不限制文件类型,允许选择 .lxmc
      }
      if (chooseVisible) {
        choosePathRef.current?.show(options)
      } else {
        setChooseVisible(true)
        requestAnimationFrame(() => {
          choosePathRef.current?.show(options)
        })
      }
    },
    [chooseVisible]
  )

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
          <TouchableOpacity key={`${item.name}_${item.rank}`} style={styles.rankItem} onPress={() => {
            // 通过 topSongs 找到完整 musicInfo 播放
            const song = topSongs.find((s) => s.name === item.name && s.singer === item.singer)
            if (!song) return
            const musicInfo = {
              id: song.id,
              name: song.name,
              singer: song.singer,
              source: 'kw' as LX.OnlineSource,
            } as LX.Music.MusicInfo
            addTempPlayList([{ listId: null, musicInfo }])
            play()
          }}>
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
          </TouchableOpacity>
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

        {/* AI 听歌报告(可选增强,不填 Key 不影响统计) */}
        <View style={styles.section}>
          <AiConfig />
        </View>

        {/* 账本数据备份 */}
        <View style={styles.section}>
          <Text size={15} color={theme['c-font']} style={styles.sectionTitle}>账本数据备份</Text>
          <View style={styles.backupRow}>
            <TouchableOpacity style={styles.backupBtn} onPress={() => showChoose('stats-export')}>
              <Text size={14} color={theme['c-primary']}>导出账本</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backupBtn} onPress={() => importConfirmRef.current?.setVisible(true)}>
              <Text size={14} color={theme['c-primary']}>导入账本</Text>
            </TouchableOpacity>
          </View>
          <Text size={11} color={theme['c-500']} style={styles.hint}>
            包含每日聚合/歌曲维度/原始事件,即热力图、排行、账本等全部本地统计
          </Text>
        </View>
      </ScrollView>
      {chooseVisible ? <ChoosePath ref={choosePathRef} onConfirm={handleChooseConfirm} /> : null}
      <ConfirmAlert
        ref={importConfirmRef}
        title="导入账本数据"
        text="导入将覆盖当前账本数据(每日聚合/歌曲/事件),确定吗?"
        cancelText="取消"
        confirmText="导入"
        bgHide={false}
        onConfirm={() => showChoose('stats-import')}
      />
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
  backupRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  backupBtn: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(128,128,128,0.4)',
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
