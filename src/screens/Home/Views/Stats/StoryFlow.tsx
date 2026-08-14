/**
 * 故事流翻卡组件(功能块③)—— 报告展示
 *
 * 依据:故事流卡片线框图.md(逐卡规格)/ 策划设计.md 第十二节功能块③
 * - 横向翻卡(pagingEnabled,一卡一屏)+ 底部圆点进度
 * - 点卡 → 长文从底部上滑展开(AnimatedSlideUpPanel,可滚动)
 * - 三档卡数:月5(封面/大数字/深夜/循环之王/海报)/ 季6(+口味变迁)/ 年8(+年度之最/关键词)
 * - 情绪卡是彩蛋(本地证据门槛:疑似安全屋 ≥2 首才出现,插在第4卡后)
 * - 降级:某层数据缺失 → 跳过对应卡;封面+海报永在;海报缺 AI 文案退化为纯数字版
 */
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native'
import { useWindowSize } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import AnimatedSlideUpPanel, { type AnimatedSlideUpPanelType } from '@/components/common/AnimatedSlideUpPanel'
import { useTheme } from '@/store/theme/hook'
import type { AiReportV2 } from '@/core/stats/schema'

/** 卡片定义 */
export interface StoryCard {
  /** 卡名(如 01 · 你的数字) */
  label: string
  /** 卡标题(封面卡用 period_name 等) */
  title: string
  /** 主视觉区内容(可多行) */
  body: string[]
  /** 底部 AI 一句话/数据锚点(可有可无) */
  note?: string
  /** 整卡底色(封面/海报用音乐颜色;其余默认主题色) */
  bgColor?: string
  /** 长文(点卡展开,可缺省) */
  letter?: string
  /** 卡片类型(海报卡特殊:有保存/重新生成按钮) */
  kind?: 'cover' | 'numbers' | 'time' | 'taste' | 'genre' | 'annual' | 'keywords' | 'poster'
}

/** 由 AiReportV2 组装卡片列表(含降级) */
export const buildCards = (report: AiReportV2): StoryCard[] => {
  const cards: StoryCard[] = []
  const { overview, time, taste, identity, compare, stories, poster } = report
  const periodLabel = report.period.start.slice(0, 7).replace('-', '.')

  // 封面卡(永在)
  const coverColor = identity?.color?.hex || '#2E3A5C'
  cards.push({
    kind: 'cover',
    label: '01 · 封面',
    title: identity?.period_name || `我的${periodLabel}听歌报告`,
    body: [`${report.period.start} — ${report.period.end}`, 'LX Music 写给你的信'],
    bgColor: coverColor,
    letter: stories?.cover,
  })

  // 大数字卡(永在)
  const playsDelta = compare?.plays_delta_pct
  const durationDelta = compare?.duration_delta_pct
  cards.push({
    kind: 'numbers',
    label: '02 · 你的数字',
    title: '这个周期,你听了',
    body: [
      `${overview.total_plays} 次播放`,
      `${overview.total_duration_min} 分钟`,
      `${overview.active_days} 天活跃`,
    ],
    note:
      playsDelta != null
        ? `次数${playsDelta >= 0 ? '多' : '少'}了${Math.abs(playsDelta)}%${durationDelta != null ? `,时长${durationDelta >= 0 ? '多' : '少'}了${Math.abs(durationDelta)}%` : ''}`
        : undefined,
    letter: stories?.numbers,
  })

  // 深夜卡(永在)
  const lateRatio = typeof time.late_night_ratio === 'number' ? Math.round(time.late_night_ratio * 100) : null
  cards.push({
    kind: 'time',
    label: '03 · 深夜高墙',
    title: '深夜高墙',
    body: [
      lateRatio != null ? `${lateRatio}% 的播放发生在 23 点之后` : '深夜时段数据不足',
      time.session_stats ? `最长连续 ${time.session_stats.longest_min} 分钟` : '',
    ],
    note: time.snooze_guess,
    letter: stories?.time,
  })

  // 循环之王卡(永在)
  const obsession = taste.repeat_obsession
  const discoveries = taste.new_discoveries
  cards.push({
    kind: 'taste',
    label: '04 · 口味',
    title: '你反复听',
    body: obsession
      ? [`《${obsession.name}》`, `${obsession.plays} 次${obsession.days ? ` · ${obsession.days} 天` : ''}`]
      : ['循环数据不足'],
    note:
      discoveries && discoveries.length > 0
        ? `这个周期,你新认识了 ${discoveries.length} 首歌`
        : undefined,
    letter: stories?.taste,
  })

  // 口味变迁卡(季度/年度才有;无对比数据跳过)
  const genreShift = taste.genre_shift
  if (genreShift?.top_genres?.length) {
    cards.push({
      kind: 'genre',
      label: '05 · 口味变迁',
      title: '口味在变',
      body: [genreShift.top_genres.slice(0, 3).join(' · ')],
      note: genreShift.shift_note || compare?.genre_shift_summary,
      letter: stories?.genre_shift,
    })
  }

  // 年度之最卡(年度)
  if (poster?.highlight) {
    cards.push({
      kind: 'annual',
      label: '06 · 年度之最',
      title: '年度之最',
      body: [poster.highlight],
      letter: stories?.annual_top,
    })
  }

  // 关键词卡(年度)
  const tags = identity?.persona_tags
  const revisit = compare?.revisit_note
  if (tags?.length || revisit) {
    cards.push({
      kind: 'keywords',
      label: '07 · 关键词',
      title: '你的年度关键词',
      body: tags?.length ? [tags.join(' · ')] : [],
      note: revisit,
      letter: stories?.keywords,
    })
  }

  // 海报卡(永在,末卡)
  cards.push({
    kind: 'poster',
    label: '08 · 保存',
    title: poster?.headline || `我的${periodLabel}听歌报告`,
    body: [
      `${overview.total_plays}次 · ${overview.total_duration_min}分钟 · ${overview.active_days}天`,
      ...(poster?.ai_copy ? [poster.ai_copy] : []),
      ...(poster?.highlight ? [poster.highlight] : []),
    ],
    bgColor: coverColor,
    letter: stories?.poster,
  })

  return cards
}

/** 故事流翻卡组件 */
export default memo(({ report }: { report: AiReportV2 }) => {
  const theme = useTheme()
  const { width: windowWidth } = useWindowSize()
  const [page, setPage] = useState(0)
  const [currentCard, setCurrentCard] = useState<StoryCard | null>(null)
  const letterRef = useRef<AnimatedSlideUpPanelType>(null)

  const cards = useMemo(() => buildCards(report), [report])

  const renderCard = useCallback(
    ({ item, index }: ListRenderItemInfo<StoryCard>) => {
      const isDark = item.bgColor != null
      const fg = isDark ? '#FFFFFF' : theme['c-font']
      const subFg = isDark ? 'rgba(255,255,255,0.75)' : theme['c-500']
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.card,
            { width: windowWidth - 40, backgroundColor: item.bgColor || theme['c-primary-background'] },
          ]}
          onPress={() => {
            if (item.letter) {
              setCurrentCard(item)
              letterRef.current?.setVisible(true)
            }
          }}
        >
          <View style={styles.cardTop}>
            <Text size={12} color={subFg}>
              {item.label}
            </Text>
            <Text size={12} color={subFg}>
              {index + 1} / {cards.length}
            </Text>
          </View>
          <View style={styles.cardMain}>
            <Text size={22} color={fg} style={styles.cardTitle}>
              {item.title}
            </Text>
            {item.body.map((line, i) =>
              line ? (
                <Text key={i} size={15} color={i === 0 && item.kind !== 'cover' ? theme['c-primary'] : fg} style={styles.cardBodyLine}>
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
              ▲ 点按展开这封信
            </Text>
          ) : null}
        </TouchableOpacity>
      )
    },
    [windowWidth, theme, cards.length]
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        renderItem={renderCard}
        keyExtractor={(_, i) => `card_${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={windowWidth - 40}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (windowWidth - 40))
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

      {/* 长文上滑面板 */}
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
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 8,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMain: {
    flex: 1,
    justifyContent: 'center',
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
