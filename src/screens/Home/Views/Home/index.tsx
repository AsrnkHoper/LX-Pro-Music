import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, TextInput, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import SourceSelector, { type SourceSelectorType } from '@/components/SourceSelector'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import { formatDurationFull, getTodayText } from '@/screens/Home/Views/Stats/utils'
import { getTimeGreeting } from '@/utils/timeGreeting'
import { getStatsDailyByDay } from '@/core/player/stats'
import { getPlayHistory, getSearchSetting, saveSearchSetting } from '@/utils/data'
import {
  addHistoryWord,
  clearHistoryList,
  getSearchHistory,
  removeHistoryWord,
  setSearchText,
} from '@/core/search/search'
import { setActiveList } from '@/core/list'
import { setNavActiveId, updateSetting } from '@/core/common'
import { useMyList } from '@/store/list/hook'
import { getListMusics } from '@/utils/listManage'
import searchMusicState from '@/store/search/music/state'

type Source = LX.OnlineSource | 'all'

const PlaylistItem = memo(({ item, showCover, cover, count, onPress }: {
  item: LX.List.MyListInfo
  showCover: boolean
  cover?: string | null
  count: number
  onPress: () => void
}) => {
  const theme = useTheme()
  if (showCover) {
    return (
      <TouchableOpacity style={styles.playlistRow} onPress={onPress} activeOpacity={0.7}>
        <Image url={cover} style={styles.playlistCover} />
        <View style={styles.playlistMain}>
          <Text size={15} color={theme['c-font']} numberOfLines={1} style={styles.playlistName}>{item.name}</Text>
          <Text size={11} color={theme['c-500']} numberOfLines={1}>{count} 首</Text>
        </View>
        <Text size={20} color={theme['c-500']}>›</Text>
      </TouchableOpacity>
    )
  }
  return (
    <TouchableOpacity style={styles.playlistRowCompact} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.playlistMain}>
        <Text size={14} color={theme['c-font']} numberOfLines={1}>{item.name}</Text>
      </View>
      <Text size={11} color={theme['c-500']}>{count} 首</Text>
    </TouchableOpacity>
  )
})

const HomeView = () => {
  const theme = useTheme()
  const showCover = useSettingValue('list.isShowCover')
  const allList = useMyList()
  const sourceSelectorRef = useRef<SourceSelectorType<Readonly<Source[]>>>(null)
  const [searchText, setSearchTextInput] = useState('')
  const [source, setSource] = useState<Source>('kw')
  const [historyList, setHistoryList] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [todayStats, setTodayStats] = useState({ duration: 0, plays: 0 })
  const [todayFavoriteList, setTodayFavoriteList] = useState('暂无')
  const [listDetails, setListDetails] = useState<Record<string, { cover?: string | null; count: number }>>({})
  const [detailsVersion, setDetailsVersion] = useState(0)

  useEffect(() => {
    void getStatsDailyByDay(getTodayText()).then((day) => {
      setTodayStats({ duration: day?.duration ?? 0, plays: day?.plays ?? 0 })
    })
    void getPlayHistory().then((history) => {
      const today = getTodayText()
      const listCount = new Map<string, number>()
      for (const item of history) {
        const day = new Date(item.playedAt)
        const dateText = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
        if (dateText !== today || !item.listId) continue
        listCount.set(item.listId, (listCount.get(item.listId) ?? 0) + 1)
      }
      if (!listCount.size) {
        setTodayFavoriteList('暂无')
        return
      }
      let bestId = ''
      let bestCount = -1
      for (const [id, count] of listCount) {
        if (count > bestCount) {
          bestId = id
          bestCount = count
        }
      }
      const target = allList.find((list) => list.id === bestId)
      setTodayFavoriteList(target?.name ?? (bestId || '暂无'))
    })
  }, [allList])

  useEffect(() => {
    void getSearchSetting().then((setting) => {
      const activeSource = (setting.source ?? 'kw') as Source
      setSource(activeSource)
      sourceSelectorRef.current?.setSourceList(searchMusicState.sources, activeSource)
    })
  }, [])

  useEffect(() => {
    const handleMusicListUpdate = () => setDetailsVersion((v) => v + 1)
    global.app_event.on('myListMusicUpdate', handleMusicListUpdate)
    return () => {
      global.app_event.off('myListMusicUpdate', handleMusicListUpdate)
    }
  }, [])

  useEffect(() => {
    if (!allList.length) return
    let cancelled = false
    void Promise.all(
      allList.map(async (list) => {
        const musics = await getListMusics(list.id)
        const latest = musics[0]
        const meta = latest?.meta as { picUrl?: string | null } | undefined
        return {
          id: list.id,
          cover: meta?.picUrl ?? null,
          count: musics.length,
        }
      })
    ).then((items) => {
      if (cancelled) return
      const map: Record<string, { cover?: string | null; count: number }> = {}
      for (const item of items) map[item.id] = { cover: item.cover, count: item.count }
      setListDetails(map)
    })
    return () => {
      cancelled = true
    }
  }, [allList, detailsVersion])

  const handleSearch = useCallback((keyword?: string) => {
    const text = (keyword ?? searchText).trim()
    if (!text) return
    setSearchTextInput(keyword ?? '')
    setShowHistory(false)
    void addHistoryWord(text)
    void saveSearchSetting({ source: source as LX.OnlineSource })
    setSearchText(text)
    setNavActiveId('nav_search')
  }, [searchText, source])

  const handleSourceChange = useCallback((s: Source) => {
    setSource(s)
    void saveSearchSetting({ source: s as LX.OnlineSource })
  }, [])

  const handleRemoveHistory = useCallback((keyword: string) => {
    setHistoryList((prev) => {
      const index = prev.indexOf(keyword)
      if (index < 0) return prev
      removeHistoryWord(index)
      const next = [...prev]
      next.splice(index, 1)
      return next
    })
  }, [])

  const handleClearHistory = useCallback(() => {
    clearHistoryList()
    setHistoryList([])
  }, [])

  const handleFocusSearch = useCallback(() => {
    setShowHistory(true)
    void getSearchHistory().then(setHistoryList)
  }, [])

  const handleBlurSearch = useCallback(() => {
    setTimeout(() => setShowHistory(false), 200)
  }, [])

  const handlePressList = useCallback((list: LX.List.MyListInfo) => {
    void setActiveList(list.id)
    setNavActiveId('nav_love')
  }, [])

  const greeting = useMemo(() => getTimeGreeting(), [])
  const dateText = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <View style={[styles.searchPill, { backgroundColor: theme['c-primary-input-background'] }]}>
          <View style={styles.sourceSelectorWrap}>
            <SourceSelector ref={sourceSelectorRef} onSourceChange={handleSourceChange} center />
          </View>
          <View style={[styles.searchDivider, { backgroundColor: theme['c-border-background'] }]} />
          <TextInput
            style={[styles.searchInput, { color: theme['c-font'] }]}
            value={searchText}
            onChangeText={setSearchTextInput}
            placeholder="搜索音乐"
            placeholderTextColor={theme['c-450']}
            returnKeyType="search"
            onSubmitEditing={() => handleSearch()}
            onFocus={handleFocusSearch}
            onBlur={handleBlurSearch}
          />
          {searchText ? (
            <TouchableOpacity style={styles.searchClear} onPress={() => setSearchTextInput('')}>
              <Text size={13} color={theme['c-500']}>✕</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: theme['c-primary'] }]} onPress={() => handleSearch()}>
            <Text size={13} color="#fff">搜索</Text>
          </TouchableOpacity>
        </View>

        {showHistory && historyList.length > 0 ? (
          <View style={[styles.historyPanel, { backgroundColor: theme['c-primary-background'] }]}>
            <View style={styles.historyHeader}>
              <Text size={13} color={theme['c-font']} style={styles.historyTitle}>搜索记录</Text>
              <TouchableOpacity onPress={handleClearHistory} style={styles.historyClearBtn}>
                <Text size={11} color={theme['c-500']}>清空</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.historyList}>
              {historyList.map((keyword, index) => (
                <View key={`${keyword}_${index}`} style={[styles.historyItem, { backgroundColor: theme['c-primary-alpha-900'] }]}>
                  <TouchableOpacity
                    style={styles.historyKeyword}
                    onPress={() => {
                      setSearchTextInput(keyword)
                      handleSearch(keyword)
                    }}
                  >
                    <Text size={12} color={theme['c-font']} numberOfLines={1}>{keyword}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.historyRemove} onPress={() => handleRemoveHistory(keyword)}>
                    <Text size={11} color={theme['c-500']}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.greetingCard}>
          <Text size={13} color="rgba(255,255,255,0.75)">{dateText}</Text>
          <Text size={24} color="#fff" style={styles.greetingTitle}>{greeting}</Text>
          <View style={styles.greetingStats}>
            <View style={styles.greetingStatItem}>
              <Text size={20} color="#fff" style={styles.greetingStatValue}>{formatDurationFull(todayStats.duration)}</Text>
              <Text size={11} color="rgba(255,255,255,0.75)">今日时长</Text>
            </View>
            <View style={styles.greetingDivider} />
            <View style={styles.greetingStatItem}>
              <Text size={20} color="#fff" style={styles.greetingStatValue}>{todayStats.plays}</Text>
              <Text size={11} color="rgba(255,255,255,0.75)">今日次数</Text>
            </View>
            <View style={styles.greetingDivider} />
            <View style={styles.greetingStatItem}>
              <Text size={20} color="#fff" style={styles.greetingStatValue} numberOfLines={1}>{todayFavoriteList}</Text>
              <Text size={11} color="rgba(255,255,255,0.75)">常听歌单</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>我的歌单</Text>
          <TouchableOpacity style={styles.modeToggle} onPress={() => updateSetting({ 'list.isShowCover': !showCover })}>
            <Text size={11} color={theme['c-primary']}>{showCover ? '简洁模式' : '详细模式'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.playlistCard, { backgroundColor: theme['c-primary-background'] }]}>
          {allList.map((list) => {
            const detail = listDetails[list.id]
            return (
              <PlaylistItem
                key={list.id}
                item={list}
                showCover={showCover}
                cover={detail?.cover}
                count={detail?.count ?? 0}
                onPress={() => handlePressList(list)}
              />
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    zIndex: 10,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 4,
  },
  sourceSelectorWrap: {
    minWidth: 78,
    height: '100%',
    justifyContent: 'center',
  },
  searchDivider: {
    width: 1,
    height: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 8,
    fontSize: 13,
  },
  searchClear: {
    paddingHorizontal: 6,
  },
  searchBtn: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  historyPanel: {
    marginTop: 8,
    borderRadius: 16,
    padding: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyTitle: {
    fontWeight: '700',
  },
  historyClearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  historyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 6,
  },
  historyKeyword: {
    maxWidth: 160,
  },
  historyRemove: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  greetingCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#0f172a',
    marginBottom: 20,
  },
  greetingTitle: {
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 16,
  },
  greetingStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  greetingStatValue: {
    fontWeight: '800',
  },
  greetingDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  modeToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(77,175,124,0.12)',
  },
  playlistCard: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  playlistCover: {
    width: 46,
    height: 46,
    borderRadius: 10,
    marginRight: 12,
  },
  playlistMain: {
    flex: 1,
  },
  playlistName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  playlistRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
})

export default HomeView
