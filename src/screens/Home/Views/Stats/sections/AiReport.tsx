import { memo, useRef } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import ReportView, { type ReportViewerType } from '../ReportView'

const PREVIEWS = [
  { emoji: '👋', title: '封面', color: '#5B6EF5', desc: '小琥珀写给你的信' },
  { emoji: '🌙', title: '深夜', color: '#F59E0B', desc: '深夜的播放更接近真实情绪' },
  { emoji: '🔁', title: '循环', color: '#8B5CF6', desc: '那首歌刚好接住了你' },
  { emoji: '🎭', title: '口味', color: '#10B981', desc: '口味变化是生活的注脚' },
]

const AiReportSection = memo(() => {
  const theme = useTheme()
  const reportRef = useRef<ReportViewerType>(null)

  return (
    <View style={[styles.section, { backgroundColor: theme['c-content-background'] }]}>
      <Text size={17} color={theme['c-primary']} style={styles.title}>AI 听歌报告</Text>
      <Text size={12} color={theme['c-500']} style={styles.desc} numberOfLines={2}>
        小琥珀为你写专属听歌周报 · 故事流翻卡 · 海报保存
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsScroll}>
        <View style={styles.cardsRow}>
          {PREVIEWS.map(item => (
            <View key={item.title} style={[styles.card, { backgroundColor: item.color }]}>
              <Text size={24}>{item.emoji}</Text>
              <Text size={13} color="#fff" numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
              <Text size={10} color="rgba(255,255,255,0.8)" numberOfLines={2}>{item.desc}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.btns}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme['c-primary'] }]} onPress={() => reportRef.current?.generate()}>
          <Text size={13} color="#fff">生成报告</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { borderColor: theme['c-500'] }]} onPress={() => reportRef.current?.openArchive()}>
          <Text size={13} color={theme['c-primary']}>报告档案</Text>
        </TouchableOpacity>
      </View>
      <ReportView ref={reportRef} />
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
    marginBottom: 6,
  },
  desc: {
    marginBottom: 10,
  },
  cardsScroll: {
    flexGrow: 0,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  card: {
    width: 128,
    borderRadius: 16,
    padding: 12,
  },
  cardTitle: {
    fontWeight: 'bold',
    marginTop: 6,
  },
  btns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  btn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
  },
})

export default AiReportSection
