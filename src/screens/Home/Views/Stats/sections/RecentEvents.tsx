import { memo, useMemo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { play } from '@/core/player/player'
import { formatRelativeTime, type StatsPageData } from '../aggregate'

interface Props {
  data: StatsPageData
}

const RecentEventsSection = memo(({ data }: Props) => {
  const theme = useTheme()
  const events = useMemo(
    () => [...data.events].sort((a, b) => b.playedAt - a.playedAt).slice(0, 8),
    [data.events]
  )

  return (
    <View style={[styles.section, { backgroundColor: theme['c-content-background'] }]}>
      <Text size={17} color={theme['c-font']} style={styles.title}>最近播放</Text>
      {events.length === 0 ? (
        <Text size={13} color={theme['c-500']} style={styles.empty}>暂无播放记录</Text>
      ) : events.map((event, index) => (
        <TouchableOpacity key={event.id || `${event.playedAt}_${index}`} style={styles.item} onPress={() => {
          if (event.musicInfo) {
            addTempPlayList([{ listId: null, musicInfo: event.musicInfo }])
            play()
          }
        }}>
          <View style={styles.dot} />
          <View style={styles.main}>
            <Text size={13} color={theme['c-font']} numberOfLines={1}>{event.musicInfo?.name || '未知歌曲'}</Text>
            <Text size={11} color={theme['c-500']} numberOfLines={1}>{event.musicInfo?.singer || '未知歌手'} · {formatRelativeTime(event.playedAt)}</Text>
          </View>
        </TouchableOpacity>
      ))}
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
  empty: {
    textAlign: 'center',
    paddingVertical: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff9d5c',
    marginRight: 12,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
})

export default RecentEventsSection
