/**
 * 故事流翻卡组件(功能块③)—— 报告展示
 *
 * 依据:故事流卡片线框图.md(逐卡规格)/ 策划设计.md 第十二节功能块③
 * - 横向翻卡(pagingEnabled,一卡一屏)+ 底部圆点进度
 * - 点卡 → 长文/详情从底部上滑展开(AnimatedSlideUpPanel,可滚动)
 * - v3 动态卡:AI 自选 3-6 张 + 惊喜卡;卡片展示中文卡名/emoji/配色
 * - 海报卡:末卡,可保存到相册 + 重新生成文案
 * - 降级:某层数据缺失 → 跳过对应卡;封面+海报永在;海报缺 AI 文案退化为纯数字版
 */
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native'
import ViewShot, { captureRef } from 'react-native-view-shot'
import { useWindowSize } from '@/utils/hooks'
import { createStyle, toast } from '@/utils/tools'
import Text from '@/components/common/Text'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import AnimatedSlideUpPanel, { type AnimatedSlideUpPanelType } from '@/components/common/AnimatedSlideUpPanel'
import { useTheme } from '@/store/theme/hook'
import { saveLocalImageToPictures } from '@/utils/image'
import type { AiReportV2 } from '@/core/stats/schema'

/** 卡片定义 */
export interface StoryCard {
  /** 卡名(如 01 · 封面) */
  label: string
  /** 卡标题(封面卡用 period_name 等) */
  title: string
  /** 主视觉区内容(可多行) */
  body: string[]
  /** 底部 AI 一句话/数据锚点(可有可无) */
  note?: string
  /** 整卡底色(封面/海报用音乐颜色;其余默认主题色) */
  bgColor?: string
  /** 长文/详情(点卡展开) */
  letter?: string
  /** 卡片类型 */
  kind?: 'cover' | 'numbers' | 'time' | 'taste' | 'genre' | 'annual' | 'keywords' | 'poster' | 'surprise'
  /** 中文卡型标签(如 🌙 深夜高墙) */
  tag?: string
  /** 标签配色 */
  tagColor?: string
}

interface CardMeta {
  name: string
  emoji: string
  color: string
  kind: StoryCard['kind']
  /** 点开长文时补的一句温暖解读 */
  detail: string
}

/** 18 种卡型 + surprise 的展示元数据(只影响 UI,不改 AI 返回的 card_key) */
const CARD_META: Record<string, CardMeta> = {
  deep_night: { name: '深夜高墙', emoji: '🌙', color: '#5B6EF5', kind: 'time', detail: '深夜的播放记录,往往比白天更接近你真实的情绪。' },
  loop_king: { name: '循环之王', emoji: '🔁', color: '#F59E0B', kind: 'taste', detail: '单曲循环不是没歌听,是那首歌刚好接住了你。' },
  taste_shift: { name: '口味变迁', emoji: '🎭', color: '#8B5CF6', kind: 'genre', detail: '口味的变化,是你这段时间生活轨迹的注脚。' },
  hidden_gem: { name: '冷门宝藏', emoji: '💎', color: '#10B981', kind: 'taste', detail: '那些播放不多、却听得很久的歌,是你私藏的小众浪漫。' },
  nostalgia: { name: '怀旧回响', emoji: '📻', color: '#F472B6', kind: 'taste', detail: '很久没听的歌突然回归,往往是某个回忆在敲门。' },
  new_frontier: { name: '新大陆', emoji: '🧭', color: '#14B8A6', kind: 'taste', detail: '新认识的歌手和新歌,是你音乐版图上新点亮的地方。' },
  emotion_ride: { name: '情绪过山车', emoji: '🎢', color: '#EF4444', kind: 'time', detail: '单日播放的大起大落,藏着你那几天的心情曲线。' },
  early_bird: { name: '早鸟', emoji: '🌅', color: '#FB923C', kind: 'time', detail: '清晨 5-8 点的播放,是你比别人更早醒来的证据。' },
  upset: { name: '爆冷逆袭', emoji: '⚡', color: '#EAB308', kind: 'taste', detail: '有些歌从低处爬起来,最后成了你的心头好。' },
  underrated: { name: '被低估的歌手', emoji: '🤫', color: '#6366F1', kind: 'taste', detail: '播放很高却不在榜首,这些歌手是你没察觉的偏爱。' },
  disconnect: { name: '断联回归', emoji: '🔗', color: '#3B82F6', kind: 'taste', detail: '上一周期消失的歌又回来了,音乐也有久别重逢。' },
  brainworm: { name: '单曲洗脑', emoji: '🧠', color: '#EC4899', kind: 'taste', detail: '同一首歌连续多天出现,旋律已经住进了你的脑子。' },
  focus_moment: { name: '专注时刻', emoji: '🎯', color: '#22C55E', kind: 'time', detail: '单次连续播放很长,那段时间你真的很专注。' },
  empty_day: { name: '空窗日', emoji: '🕳️', color: '#64748B', kind: 'time', detail: '没有播放的日子,也是生活的一部分,不需要解释。' },
  fragments: { name: '碎片时间', emoji: '🧩', color: '#0EA5E9', kind: 'time', detail: '平均播放很短,音乐成了你生活里的碎片背景。' },
  night_whisper: { name: '深夜私语', emoji: '🌌', color: '#4F46E5', kind: 'time', detail: '深夜听的小众歌,是你和自己的悄悄话。' },
  outside_playlist: { name: '歌单之外', emoji: '🛰️', color: '#0D9488', kind: 'taste', detail: '歌单之外自己找到的歌,往往藏着最真实的你。' },
  new_king: { name: '年度新王', emoji: '👑', color: '#D97706', kind: 'taste', detail: '新歌迅速登顶,它一定在某个时刻击中了你的耳朵。' },
  surprise: { name: '惊喜卡', emoji: '✨', color: '#F97316', kind: 'surprise', detail: '数据里总有些意外,是报告最有趣的部分。' },
}

const DEFAULT_META: CardMeta = { name: '本周故事', emoji: '📌', color: '#6B7280', kind: 'time', detail: '数据会说话,慢慢听它讲。' }

const periodLabelOf = (report: AiReportV2) => report.period.start.slice(0, 7).replace('-', '.')

const buildCoverLetter = (report: AiReportV2): string => {
  const { overview, identity, poster } = report
  const topSong = overview.top_song?.name ? `\n本周听得最多的是《${overview.top_song.name}》(${overview.top_song.plays} 次)。` : ''
  return `${identity?.period_name || `我的${periodLabelOf(report)}听歌报告`}\n\n${report.period.start} ~ ${report.period.end}\n\n这一周你播放了 ${overview.total_plays} 次,累计 ${Math.round(overview.total_duration_min)} 分钟,活跃 ${overview.active_days} 天。${topSong}\n\n${poster?.ai_copy || '慢慢看,这是你的听歌故事。'}`
}

const buildCardLetter = (report: AiReportV2, body: string | undefined, data_basis: string | undefined, meta: CardMeta): string => {
  return `${body || '这一周的音乐,藏着你没注意到的细节。'}\n\n${meta.detail}\n\n数据依据:${data_basis || '来自本地听歌统计'}\n\n—— LX Music 听歌报告 · ${report.period.start} ~ ${report.period.end}`
}

const buildPosterLetter = (report: AiReportV2): string => {
  const { overview, poster } = report
  return `${poster?.headline || `我的${periodLabelOf(report)}听歌报告`}\n\n${poster?.ai_copy || '这一周的听歌故事,都在数字里。'}\n\n${poster?.highlight || ''}\n\n${overview.total_plays} 次播放 · ${Math.round(overview.total_duration_min)} 分钟 · 活跃 ${overview.active_days} 天\n\n—— ${report.period.start} ~ ${report.period.end}`
}

/** 由 AiReportV2 组装卡片列表(v3:封面固定 + AI 自选 cards 数组 + 海报固定) */
export const buildCards = (report: AiReportV2): StoryCard[] => {
  const cards: StoryCard[] = []
  const { overview, identity, poster } = report
  const periodLabel = periodLabelOf(report)

  // 封面卡(固定,永在)
  const coverColor = identity?.color?.hex || '#2E3A5C'
  cards.push({
    kind: 'cover',
    label: '01 · 封面',
    title: identity?.period_name || `我的${periodLabel}听歌报告`,
    body: [`${report.period.start} — ${report.period.end}`, 'LX Music 写给你的信'],
    bgColor: coverColor,
    letter: buildCoverLetter(report),
  })

  // 动态卡(AI 从卡型菜单自选,2026-08-16 v3)
  const dynamic = report.cards ?? []
  dynamic.forEach((c, i) => {
    const meta = CARD_META[c.card_key] ?? DEFAULT_META
    cards.push({
      kind: meta.kind,
      label: `${String(i + 2).padStart(2, '0')} · ${meta.name}`,
      title: c.title || '这周的故事',
      body: c.body ? [c.body] : [],
      note: c.data_basis,
      tag: `${meta.emoji} ${meta.name}`,
      tagColor: meta.color,
      letter: buildCardLetter(report, c.body, c.data_basis, meta),
    })
  })

  // 海报卡(固定,末卡)
  cards.push({
    kind: 'poster',
    label: '末卡 · 海报',
    title: poster?.headline || `我的${periodLabel}听歌报告`,
    body: [
      `${overview.total_plays}次 · ${Math.round(overview.total_duration_min)}分钟 · ${overview.active_days}天`,
      ...(poster?.ai_copy ? [poster.ai_copy] : []),
      ...(poster?.highlight ? [poster.highlight] : []),
    ],
    bgColor: coverColor,
    tag: '🖼️ 海报',
    tagColor: 'rgba(255,255,255,0.28)',
    letter: buildPosterLetter(report),
  })

  return cards
}

/** 故事流翻卡组件 */
export default memo(({ report, onRegeneratePoster }: { report: AiReportV2; onRegeneratePoster?: () => void }) => {
  const theme = useTheme()
  const { width: windowWidth } = useWindowSize()
  const [page, setPage] = useState(0)
  const [currentCard, setCurrentCard] = useState<StoryCard | null>(null)
  const letterRef = useRef<AnimatedSlideUpPanelType>(null)
  const posterShotRef = useRef<ViewShot>(null)
  const regenConfirmRef = useRef<ConfirmAlertType>(null)

  const cards = useMemo(() => buildCards(report), [report])

  const openLetter = useCallback((card: StoryCard) => {
    if (!card.letter) return
    setCurrentCard(card)
    letterRef.current?.setVisible(true)
  }, [])

  const handleSavePoster = useCallback(() => {
    const ref = posterShotRef.current
    if (!ref) return
    void (async () => {
      try {
        toast('正在生成海报图片...', 'short')
        const uri = await captureRef(ref, { format: 'jpg', quality: 100, result: 'tmpfile' })
        const savedPath = await saveLocalImageToPictures(uri, `LX_听歌报告_${report.period.start}_${report.period.end}`)
        if (savedPath) toast(`海报已保存到: ${savedPath}`, 'long')
      } catch (err: any) {
        toast(`保存海报失败: ${err?.message ?? err}`, 'long')
      }
    })()
  }, [report.period])

  const renderCard = useCallback(
    ({ item, index }: ListRenderItemInfo<StoryCard>) => {
      const isDark = item.bgColor != null
      const fg = isDark ? '#FFFFFF' : theme['c-font']
      const subFg = isDark ? 'rgba(255,255,255,0.75)' : theme['c-500']
      const cardStyle = [
        styles.card,
        { width: windowWidth - 48, backgroundColor: item.bgColor || theme['c-primary-background'] },
      ]

      const cardFace = (
        <>
          <View style={styles.cardTop}>
            <Text size={12} color={subFg}>
              {item.label}
            </Text>
            <Text size={12} color={subFg}>
              {index + 1} / {cards.length}
            </Text>
          </View>
          <View style={styles.cardMain}>
            {item.tag ? (
              <View style={[styles.cardTag, { backgroundColor: item.tagColor || theme['c-primary'] }]}>
                <Text size={11} color="#FFFFFF">
                  {item.tag}
                </Text>
              </View>
            ) : null}
            <Text size={22} color={fg} style={styles.cardTitle}>
              {item.title}
            </Text>
            {item.body.map((line, i) =>
              line ? (
                <Text
                  key={i}
                  size={15}
                  color={i === 0 && item.kind !== 'cover' ? theme['c-primary'] : fg}
                  style={styles.cardBodyLine}
                >
                  {line}
                </Text>
              ) : null
            )}
            {item.note ? (
              <Text size={13} color={subFg} style={styles.cardNote}>
                {item.note}
              </Text>
            ) : null}
          </View>
          {item.letter ? (
            <Text size={12} color={subFg} style={styles.cardHint}>
              ▲ 点按展开详情
            </Text>
          ) : null}
        </>
      )

      if (item.kind === 'poster') {
        return (
          <View style={[cardStyle, styles.cardPoster]}>
            <ViewShot
              ref={posterShotRef}
              style={[styles.posterShot, { backgroundColor: item.bgColor || theme['c-primary-background'] }]}
              options={{ format: 'jpg', quality: 100 }}
            >
              {cardFace}
            </ViewShot>
            <View style={styles.posterActions}>
              <TouchableOpacity style={[styles.posterBtn, { borderColor: fg }]} onPress={handleSavePoster}>
                <Text size={14} color={fg}>
                  保存到相册
                </Text>
              </TouchableOpacity>
              {onRegeneratePoster ? (
                <TouchableOpacity
                  style={[styles.posterBtn, { borderColor: fg }]}
                  onPress={() => regenConfirmRef.current?.setVisible(true)}
                >
                  <Text size={14} color={fg}>
                    重新生成文案
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )
      }

      return (
        <TouchableOpacity activeOpacity={0.85} style={cardStyle} onPress={() => openLetter(item)}>
          {cardFace}
        </TouchableOpacity>
      )
    },
    [windowWidth, theme, cards.length, handleSavePoster, onRegeneratePoster, openLetter]
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        renderItem={renderCard}
        keyExtractor={(_, i) => `card_${i}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={windowWidth - 48}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (windowWidth - 48))
          setPage(Math.min(Math.max(idx, 0), cards.length - 1))
        }}
        contentContainerStyle={styles.listContent}
      />
      {/* 底部圆点进度 */}
      <View style={styles.dots}>
        {cards.map((_, i) => (
          <View key={i} style={[styles.dot, i === page ? styles.dotActive : null]} />
        ))}
      </View>

      {/* 详情上滑面板 */}
      <AnimatedSlideUpPanel ref={letterRef}>
        <View style={styles.letterPanel}>
          <TouchableOpacity onPress={() => letterRef.current?.setVisible(false)}>
            <Text size={14} color={theme['c-primary']}>
              ← 返回卡片
            </Text>
          </TouchableOpacity>
          <Text size={18} color={theme['c-font']} style={styles.letterTitle}>
            {currentCard?.title}
          </Text>
          <Text size={14} color={theme['c-font']} style={styles.letterBody}>
            {currentCard?.letter}
          </Text>
        </View>
      </AnimatedSlideUpPanel>

      {/* 重新生成文案确认弹窗 */}
      <ConfirmAlert
        ref={regenConfirmRef}
        title="重新生成文案"
        text="将重新请求 AI 生成本周报告(烧一次 token),确定吗?"
        cancelText="取消"
        confirmText="重新生成"
        bgHide={false}
        onConfirm={() => {
          onRegeneratePoster?.()
        }}
      />
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    justifyContent: 'space-between',
  },
  cardPoster: {
    padding: 0,
    overflow: 'hidden',
  },
  posterShot: {
    flex: 1,
    padding: 20,
  },
  posterActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  posterBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 0.5,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMain: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  cardBodyLine: {
    marginVertical: 4,
    fontWeight: 'bold',
  },
  cardNote: {
    marginTop: 16,
    lineHeight: 20,
  },
  cardHint: {
    textAlign: 'center',
    paddingTop: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: 'rgba(128,128,128,0.4)',
  },
  dotActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: 20,
  },
  letterPanel: {
    padding: 20,
    paddingBottom: 40,
  },
  letterTitle: {
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  letterBody: {
    lineHeight: 24,
  },
})
