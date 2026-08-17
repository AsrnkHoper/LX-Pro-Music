import { memo, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  View,
  FlatList,
  type FlatListProps,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
  TouchableOpacity,
  PanResponder,
} from 'react-native'
import { type Line, useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { createStyle } from '@/utils/tools'
import { updateSetting } from '@/core/common'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { AnimatedColorText } from '@/components/common/Text'
import { setSpText } from '@/utils/pixelRatio'
import settingState from '@/store/setting/state'
import playerState from '@/store/player/state'
import { scrollTo } from '@/utils/scroll'
import PlayLine, { type PlayLineType } from './PlayLine'
import { useAnimateNumber } from '@/utils/hooks/useAnimateNumber'

type FlatListType = FlatListProps<Line>

export type LyricViewVariant = 'vertical' | 'horizontal' | 'landscape'

type LyricFontSizeKey =
  | 'playDetail.vertical.style.lrcFontSize'
  | 'playDetail.horizontal.style.lrcFontSize'
  | 'playDetail.landscapeImmersion.style.lrcFontSize'

type LyricAlignKey = 'playDetail.style.align'

export interface LyricViewProps {
  /** 歌词字号设置键 */
  fontSizeKey: LyricFontSizeKey
  /** 对齐设置键，默认 'playDetail.style.align' */
  alignKey?: LyricAlignKey
  /** 配色变体：vertical/horizontal/landscape */
  variant?: LyricViewVariant
  /** 是否启用双指缩放字号 */
  enableZoom?: boolean
  /** 是否显示播放进度线（PlayLine） */
  showPlayLine?: boolean
  /** 当前行滚动到的位置（0-1），默认 0.42 */
  viewPosition?: number
  /** 行高倍数，默认 1.3 */
  lineHeightRatio?: number
  /** 水平内边距，默认 20 */
  paddingHorizontal?: number
  /** 右侧内边距（覆盖 paddingHorizontal 的右侧），默认同 paddingHorizontal */
  paddingRight?: number
  /** 列表上下留白，默认 '100%'（header/footer 模式） */
  spaceSize?: string
  /** 上下留白使用 contentContainerStyle padding（横屏沉浸模式用） */
  useContentPadding?: boolean
  /** 翻译字号比例，默认 0.8 */
  translationScale?: number
  /** 当前行放大倍数（Apple Music 风格），默认 1.15 */
  activeScale?: number
  /** 相邻非当前行透明度，默认 0.75 */
  inactiveOpacityNear?: number
  /** 较远非当前行透明度，默认 0.55 */
  inactiveOpacityFar?: number
}

interface LrcLineProps {
  line: Line
  lineNum: number
  activeLine: number
  fontSizeKey: LyricFontSizeKey
  alignKey: LyricAlignKey
  variant: LyricViewVariant
  lineHeightRatio: number
  translationScale: number
  activeScale: number
  inactiveOpacityNear: number
  inactiveOpacityFar: number
  onLayout: (lineNum: number, height: number, width: number) => void
  onPress: (index: number) => void
}

const LrcLine = memo(
  ({ line, lineNum, activeLine, fontSizeKey, alignKey, variant, lineHeightRatio, translationScale, activeScale, inactiveOpacityNear, inactiveOpacityFar, onLayout, onPress }: LrcLineProps) => {
    const theme = useTheme()
    const lrcFontSize = useSettingValue(fontSizeKey)
    const textAlign = useSettingValue(alignKey)
    const size = lrcFontSize / 10
    const active = activeLine == lineNum
    const distance = Math.abs(lineNum - activeLine)

    const colors = useMemo(() => {
      if (active) {
        if (variant == 'horizontal') {
          return [theme['c-primary'], theme['c-primary-alpha-200']] as const
        }
        return [theme.isDark ? theme['c-font'] : theme['c-primary-font-active'], theme['c-primary-alpha-200']] as const
      }
      if (variant == 'horizontal') {
        return [theme['c-350'], theme['c-300']] as const
      }
      return [theme['c-450'], theme['c-400']] as const
    }, [active, variant, theme])

    const opacity = active ? 1 : distance <= 1 ? inactiveOpacityNear : inactiveOpacityFar

    // 字号动画：当前行放大（Apple Music 风格），行高保持静态避免触发大量 onLayout
    const targetSize = setSpText(size * (active ? activeScale : 1))
    const [animatedSize] = useAnimateNumber(targetSize, 800, false)
    const lineHeight = setSpText(size) * lineHeightRatio
    const translationLineHeight = lineHeight * translationScale

    const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
      onLayout(lineNum, nativeEvent.layout.height, nativeEvent.layout.width)
    }

    const handlePress = useCallback(() => {
      onPress(lineNum)
    }, [onPress, lineNum])

    // textBreakStrategy="simple" 用于解决某些设备上字体被截断的问题
    // https://stackoverflow.com/a/72822360
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={handlePress}>
        <View style={styles.line} onLayout={handleLayout}>
          <AnimatedColorText
            style={{
              ...styles.lineText,
              textAlign,
              lineHeight,
              fontSize: animatedSize,
            }}
            textBreakStrategy="simple"
            color={colors[0]}
            opacity={opacity}
            size={size}
          >
            {line.text}
          </AnimatedColorText>
          {line.extendedLyrics.map((lrc, index) => {
            return (
              <AnimatedColorText
                style={{
                  ...styles.lineTranslationText,
                  textAlign,
                  lineHeight: translationLineHeight,
                }}
                textBreakStrategy="simple"
                key={index}
                color={colors[1]}
                opacity={opacity}
                size={size * translationScale}
              >
                {lrc}
              </AnimatedColorText>
            )
          })}
        </View>
      </TouchableOpacity>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.line === nextProps.line &&
      prevProps.lineNum === nextProps.lineNum &&
      prevProps.activeLine === nextProps.activeLine &&
      prevProps.fontSizeKey === nextProps.fontSizeKey &&
      prevProps.alignKey === nextProps.alignKey &&
      prevProps.variant === nextProps.variant &&
      prevProps.onPress === nextProps.onPress
    )
  }
)

const wait = async () => new Promise((resolve) => setTimeout(resolve, 100))

/**
 * 统一歌词滚动视图：滚动 / 点按 seek / 双指缩放 / 播放进度线 / Apple Music 风格当前行放大
 */
export default memo((props: LyricViewProps) => {
  const {
    fontSizeKey,
    alignKey = 'playDetail.style.align',
    variant = 'vertical',
    enableZoom = false,
    showPlayLine = false,
    viewPosition = 0.42,
    lineHeightRatio = 1.3,
    paddingHorizontal = 20,
    paddingRight,
    spaceSize = '100%',
    useContentPadding = false,
    translationScale = 0.8,
    activeScale = 1.15,
    inactiveOpacityNear = 0.75,
    inactiveOpacityFar = 0.55,
  } = props

  const lyricLines = useLrcSet()
  const { line } = useLrcPlay()
  const flatListRef = useRef<FlatList>(null)
  const playLineRef = useRef<PlayLineType>(null)
  const isPauseScrollRef = useRef(true)
  const scrollTimoutRef = useRef<NodeJS.Timeout | null>(null)
  const delayScrollTimeout = useRef<NodeJS.Timeout | null>(null)
  const lineRef = useRef({ line: 0, prevLine: 0 })
  const isFirstSetLrc = useRef(true)
  const scrollInfoRef = useRef<NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null>(null)
  const listLayoutInfoRef = useRef<{ spaceHeight: number; lineHeights: number[] }>({
    spaceHeight: 0,
    lineHeights: [],
  })
  const scrollCancelRef = useRef<(() => void) | null>(null)
  const isShowLyricProgressSetting = useSettingValue('playDetail.isShowLyricProgressSetting')

  const initialDistanceRef = useRef(0)
  const initialFontSizeRef = useRef(0)

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
    onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
    onPanResponderGrant: (evt) => {
      if (evt.nativeEvent.touches.length === 2) {
        const dx = evt.nativeEvent.touches[0].pageX - evt.nativeEvent.touches[1].pageX
        const dy = evt.nativeEvent.touches[0].pageY - evt.nativeEvent.touches[1].pageY
        initialDistanceRef.current = Math.sqrt(dx * dx + dy * dy)
        initialFontSizeRef.current = settingState.setting[fontSizeKey]
      }
    },
    onPanResponderMove: (evt) => {
      if (evt.nativeEvent.touches.length === 2 && initialDistanceRef.current > 0) {
        const dx = evt.nativeEvent.touches[0].pageX - evt.nativeEvent.touches[1].pageX
        const dy = evt.nativeEvent.touches[0].pageY - evt.nativeEvent.touches[1].pageY
        const distance = Math.sqrt(dx * dx + dy * dy)

        const scale = distance / initialDistanceRef.current
        let newSize = Math.round((initialFontSizeRef.current * scale) / 2) * 2
        newSize = Math.max(100, Math.min(newSize, 300))

        if (settingState.setting[fontSizeKey] !== newSize) {
          const newSetting: Partial<LX.AppSetting> = {}
          newSetting[fontSizeKey] = newSize
          updateSetting(newSetting)
        }
      }
    },
    onPanResponderRelease: () => {
      initialDistanceRef.current = 0
    },
    onPanResponderTerminate: () => {
      initialDistanceRef.current = 0
    }
  }), [fontSizeKey])

  const handleScrollToActive = (index = lineRef.current.line) => {
    if (index < 0) return
    if (flatListRef.current) {
      if (scrollInfoRef.current && lineRef.current.line - lineRef.current.prevLine == 1) {
        let offset = listLayoutInfoRef.current.spaceHeight
        for (let l = 0; l < index; l++) {
          offset += listLayoutInfoRef.current.lineHeights[l] ?? 0
        }
        offset += (listLayoutInfoRef.current.lineHeights[index] ?? 0) / 2
        try {
          scrollCancelRef.current = scrollTo(
            flatListRef.current,
            scrollInfoRef.current,
            offset - scrollInfoRef.current.layoutMeasurement.height * viewPosition,
            600,
            () => {
              scrollCancelRef.current = null
            }
          )
        } catch { }
      } else {
        if (scrollCancelRef.current) {
          scrollCancelRef.current()
          scrollCancelRef.current = null
        }
        try {
          flatListRef.current.scrollToIndex({
            index,
            animated: true,
            viewPosition,
          })
        } catch { }
      }
    }
  }

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollInfoRef.current = nativeEvent
    if (isPauseScrollRef.current) {
      playLineRef.current?.updateScrollInfo(nativeEvent)
    }
  }
  const handleScrollBeginDrag = () => {
    isPauseScrollRef.current = true
    playLineRef.current?.setVisible(true)
    if (delayScrollTimeout.current) {
      clearTimeout(delayScrollTimeout.current)
      delayScrollTimeout.current = null
    }
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
    if (scrollCancelRef.current) {
      scrollCancelRef.current()
      scrollCancelRef.current = null
    }
  }

  const onScrollEndDrag = () => {
    if (!isPauseScrollRef.current) return
    if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current)
    scrollTimoutRef.current = setTimeout(() => {
      playLineRef.current?.setVisible(false)
      scrollTimoutRef.current = null
      isPauseScrollRef.current = false
      if (!playerState.isPlay) return
      handleScrollToActive()
    }, 3000)
  }

  useEffect(() => {
    return () => {
      if (delayScrollTimeout.current) {
        clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = null
      }
      if (scrollTimoutRef.current) {
        clearTimeout(scrollTimoutRef.current)
        scrollTimoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    listLayoutInfoRef.current.lineHeights = []
    lineRef.current.prevLine = 0
    lineRef.current.line = 0
    if (!flatListRef.current) return
    flatListRef.current.scrollToOffset({
      offset: 0,
      animated: false,
    })
    if (!lyricLines.length) return
    playLineRef.current?.updateLyricLines(lyricLines)
    requestAnimationFrame(() => {
      if (isFirstSetLrc.current) {
        isFirstSetLrc.current = false
        setTimeout(() => {
          isPauseScrollRef.current = false
          handleScrollToActive()
        }, 100)
      } else {
        if (delayScrollTimeout.current) clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = setTimeout(() => {
          handleScrollToActive(0)
        }, 100)
      }
    })
  }, [lyricLines])

  useEffect(() => {
    if (line < 0) return
    lineRef.current.prevLine = lineRef.current.line
    lineRef.current.line = line
    if (!flatListRef.current || isPauseScrollRef.current) return

    if (line - lineRef.current.prevLine != 1) {
      handleScrollToActive()
      return
    }

    delayScrollTimeout.current = setTimeout(() => {
      delayScrollTimeout.current = null
      handleScrollToActive()
    }, 600)
  }, [line])

  useEffect(() => {
    requestAnimationFrame(() => {
      playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
      playLineRef.current?.updateLyricLines(lyricLines)
    })
  }, [isShowLyricProgressSetting])

  const handleScrollToIndexFailed: FlatListType['onScrollToIndexFailed'] = (info) => {
    void wait().then(() => {
      handleScrollToActive(info.index)
    })
  }

  const handleLineLayout = useCallback<LrcLineProps['onLayout']>((lineNum, height) => {
    listLayoutInfoRef.current.lineHeights[lineNum] = height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handleSpaceLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    listLayoutInfoRef.current.spaceHeight = nativeEvent.layout.height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handlePlayLine = useCallback((time: number) => {
    playLineRef.current?.setVisible(false)
    global.app_event.setProgress(time)
  }, [])

  const handleLinePress = useCallback((index: number) => {
    if (!isShowLyricProgressSetting) return
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
    if (scrollCancelRef.current) {
      scrollCancelRef.current()
      scrollCancelRef.current = null
    }
    isPauseScrollRef.current = false
    const line = lyricLines[index]
    if (line) {
      global.app_event.setProgress(line.time / 1000)
    }
    handleScrollToActive(index)
  }, [isShowLyricProgressSetting, lyricLines])

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => {
    return (
      <LrcLine
        line={item}
        lineNum={index}
        activeLine={line}
        fontSizeKey={fontSizeKey}
        alignKey={alignKey}
        variant={variant}
        lineHeightRatio={lineHeightRatio}
        translationScale={translationScale}
        activeScale={activeScale}
        inactiveOpacityNear={inactiveOpacityNear}
        inactiveOpacityFar={inactiveOpacityFar}
        onLayout={handleLineLayout}
        onPress={handleLinePress}
      />
    )
  }
  const getkey: FlatListType['keyExtractor'] = (item, index) => `${index}${item.text}${item.extendedLyrics.join('')}`

  const spaceComponent = useMemo(
    () => <View style={styles.space} onLayout={handleSpaceLayout} />,
    [handleSpaceLayout]
  )

  const listProps = {
    data: lyricLines,
    renderItem,
    keyExtractor: getkey,
    style: styles.list,
    showsVerticalScrollIndicator: false,
    onScrollBeginDrag: handleScrollBeginDrag,
    onScrollEndDrag: onScrollEndDrag,
    onMomentumScrollBegin: handleScrollBeginDrag,
    onMomentumScrollEnd: onScrollEndDrag,
    fadingEdgeLength: 100,
    initialNumToRender: Math.max(line + 10, 10),
    onScrollToIndexFailed: handleScrollToIndexFailed,
    onScroll: handleScroll,
  }

  const containerStyle = useMemo(() => [
    styles.container,
    { paddingLeft: paddingHorizontal, paddingRight: paddingRight ?? paddingHorizontal },
  ], [paddingHorizontal, paddingRight])

  const panHandlers = enableZoom ? panResponder.panHandlers : undefined

  return (
    <View style={containerStyle} {...panHandlers}>
      {useContentPadding ? (
        <FlatList
          {...listProps}
          ref={flatListRef}
          contentContainerStyle={styles.contentPadding}
        />
      ) : (
        <FlatList
          {...listProps}
          ref={flatListRef}
          ListHeaderComponent={spaceComponent}
          ListFooterComponent={spaceComponent}
        />
      )}
      {showPlayLine && isShowLyricProgressSetting ? (
        <PlayLine ref={playLineRef} onPlayLine={handlePlayLine} />
      ) : null}
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  contentPadding: {
    paddingVertical: '48%',
  },
  space: {
    paddingTop: '100%',
  },
  line: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  lineText: {
    textAlign: 'center',
  },
  lineTranslationText: {
    textAlign: 'center',
    paddingTop: 5,
  },
})
