import { memo, useCallback, useMemo, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { play } from '@/core/player/player'
import { getPlayHistory } from '@/utils/data'
import listState from '@/store/list/state'
import { formatDuration } from '../utils'
import type { StatsPageData, TimeRange } from '../aggregate'

interface Props {
  data: StatsPageData
  range: TimeRange
}

const COVER_COLORS = ['#ff7a5c', '#7c4dff', '#ffb347', '#5a6db0']

const RankingsSection = memo(({ data }: Props) => {
  const theme = useTheme()
  const [tab, setTab] = useState<'song' | 'artist'>('song')

  const songRows = useMemo(() => {
    return [...data.song]
      .filter(item => item.plays > 0)
      .sort((a, b) => b.plays - a.plays || b.duration - a.duration)
      .slice(0, 10)
      .map((item, index) => ({
        id: item.id,
        rank: index + 1,
        name: item.name,
        sub: item.singer,
        plays: item.plays,
        duration: item.duration,
      }))
  }, [data.song])

  const artistRows = useMemo(() => {
    const map = new Map<string, { singer: string; plays: number; duration: number; songs: number }>()
    for (const item of data.song) {
      if (item.plays <= 0) continue
      const cur = map.get(item.singer)
      if (cur) {
        cur.plays += item.plays
        cur.duration += item.duration
        cur.songs += 1
      } else {
        map.set(item.singer, { singer: item.singer, plays: item.plays, duration: item.duration, songs: 1 })
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.plays - a.plays || b.duration - a.duration)
      .slice(0, 10)
      .map((item, index) => ({
        id: item.singer,
        rank: index + 1,
        name: item.singer,
        sub: `${item.plays} 次 · ${item.songs} 首`,
        plays: item.plays,
        duration: item.duration,
      }))
  }, [data.song])

  const rows = tab === 'song' ? songRows : artistRows
  const maxPlays = Math.max(1, ...rows.map(r => r.plays))

  const handlePlay = useCallback(async (id: string) => {
    // 优先从内存歌单反查完整 musicInfo（allMusicList 以 id 为索引）
    const fullInfo = listState.allMusicList.get(id)?.[0]
    if (fullInfo) {
      addTempPlayList([{ listId: null, musicInfo: fullInfo }])
      play()
      return
    }
    try {
      const history = await getPlayHistory()
      const histItem = history.find(h => h.musicInfo.id === id)
      if (histItem) {
        addTempPlayList([{ listId: null, musicInfo: histItem.musicInfo }])
        play()
      } else {
        toast('无法播放：缺少歌曲来源信息')
      }
    } catch {
      toast('无法播放：读取历史失败')
    }
  }, [])

  return (
    <View style={[styles.section, { backgroundColor: theme['c-content-background'] }]}>
      <Text size={17} color={theme['c-font']} style={styles.title}>排行榜</Text>
      <View style={styles.tabs}>
        {(['song', 'artist'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text size={12} color={tab === t ? '#1a0a14' : theme['c-500']}>{t === 'song' ? '歌曲' : '歌手'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.list}>
        {rows.length === 0 ? (
          <Text size={13} color={theme['c-500']} style={styles.empty}>暂无数据，听歌后自动统计</Text>
        ) : rows.map((item, index) => (
          <TouchableOpacity key={`${tab}_${item.id}`} style={styles.row} onPress={() => handlePlay(item.id)}>
            <Text size={16} color={item.rank <= 3 ? theme['c-primary'] : theme['c-500']} style={styles.rank} numberOfLines={1}>{item.rank}</Text>
            <View style={[styles.cover, { backgroundColor: COVER_COLORS[index % COVER_COLORS.length] }]} />
            <View style={styles.info}>
              <Text size={13} color={theme['c-font']} numberOfLines={1}>{item.name}</Text>
              <Text size={11} color={theme['c-500']} numberOfLines={1}>{item.sub}</Text>
              <View style={styles.pbar}>
                <View style={[styles.pbarFill, { width: `${Math.max(4, (item.plays / maxPlays) * 100)}%` }]} />
              </View>
            </View>
            <View style={styles.right}>
              <Text size={12} color={theme['c-primary']} numberOfLines={1}>{item.plays} 次</Text>
              <Text size={10} color={theme['c-500']} numberOfLines={1}>{formatDuration(item.duration)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
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
  tabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 999,
    padding: 3,
    backgroundColor: 'rgba(128,128,128,0.12)',
    marginBottom: 10,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  tabActive: {
    backgroundColor: '#ffb347',
  },
  list: {
    marginTop: 4,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rank: {
    width: 28,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  cover: {
    width: 38,
    height: 38,
    borderRadius: 10,
    marginRight: 10,
  },
  info: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  pbar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.15)',
    marginTop: 4,
    overflow: 'hidden',
  },
  pbarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#ff9d5c',
  },
  right: {
    width: 70,
    alignItems: 'flex-end',
  },
})

export default RankingsSection
