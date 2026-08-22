import { useCallback, useRef, useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'
import Source from '@/screens/Home/Views/Setting/settings/Basic/Source'
import PlayHighQuality from '@/screens/Home/Views/Setting/settings/Player/PlayHighQuality'
import ThemeGroup from '@/screens/Home/Views/Setting/settings/Theme'
import IsShowLyricTranslation from '@/screens/Home/Views/Setting/settings/Player/IsShowLyricTranslation'
import IsShowLyricRoma from '@/screens/Home/Views/Setting/settings/Player/IsShowLyricRoma'
import IsShowBluetoothLyric from '@/screens/Home/Views/Setting/settings/Player/IsShowBluetoothLyric'

const IntroPage = ({ step, title, children }: { step: number; title: string; children: React.ReactNode }) => {
  const theme = useTheme()
  return (
    <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent}>
      <Text size={12} color={theme['c-500']} style={styles.pageStep}>第 {step} 页</Text>
      <Text size={26} color={theme['c-font']} style={styles.pageTitle}>{title}</Text>
      <View style={styles.pageBody}>{children}</View>
    </ScrollView>
  )
}

const ConfigPage = ({ step, title, desc, children }: { step: number; title: string; desc: string; children: React.ReactNode }) => {
  const theme = useTheme()
  return (
    <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent}>
      <Text size={12} color={theme['c-500']} style={styles.pageStep}>第 {step} 页</Text>
      <Text size={24} color={theme['c-font']} style={styles.pageTitle}>{title}</Text>
      <Text size={13} color={theme['c-500']} style={styles.pageDesc}>{desc}</Text>
      <View style={styles.pageBody}>{children}</View>
    </ScrollView>
  )
}

const LyricSettings = () => {
  return (
    <View style={styles.lyricSettings}>
      <IsShowLyricTranslation />
      <IsShowLyricRoma />
      <IsShowBluetoothLyric />
    </View>
  )
}

const TOTAL_PAGES = 7

const Oobe = () => {
  const theme = useTheme()
  const oobeFinished = useSettingValue('common.oobeFinished')
  const [pageIndex, setPageIndex] = useState(0)
  const pagerRef = useRef<PagerView>(null)

  const handlePageSelected = useCallback(({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    setPageIndex(nativeEvent.position)
  }, [])

  const goToPage = useCallback((index: number) => {
    const next = Math.max(0, Math.min(TOTAL_PAGES - 1, index))
    setPageIndex(next)
    pagerRef.current?.setPage(next)
  }, [])

  const finish = useCallback(() => {
    updateSetting({ 'common.oobeFinished': true })
  }, [])

  if (oobeFinished) return null

  const skip = finish

  const isLast = pageIndex === TOTAL_PAGES - 1

  return (
    <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
      <View style={styles.topBar}>
        <Text size={14} color={theme['c-500']}>LX-Pro Music 使用引导</Text>
        <TouchableOpacity onPress={skip} style={styles.skipTop}>
          <Text size={13} color={theme['c-primary']}>跳过</Text>
        </TouchableOpacity>
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        <IntroPage key="i1" step={1} title="欢迎使用 LX-Pro Music">
          <Text size={15} color={theme['c-font']} style={styles.paragraph}>
            LX-Pro Music 是一个以本地播放为主的音乐应用，也能在线找歌、听歌。它不绑死某一个平台，你可以用自己习惯的音源，也可以直接播放存在设备里的音乐文件。
          </Text>
          <Text size={15} color={theme['c-font']} style={styles.paragraph}>
            和大多数音乐软件不同，LX-Pro Music 的界面、音质、主题、歌词这些，基本都能按你的习惯来调。第一次使用前，我们花一分钟做点基础设置。
          </Text>
        </IntroPage>

        <IntroPage key="i2" step={2} title="高度自定义">
          <Text size={15} color={theme['c-font']} style={styles.paragraph}>
            音质、主题、歌词、列表样式、侧边栏顺序，还有数据同步方式，都可以改。这里设置过的东西，以后在设置里也能随时调整。
          </Text>
          <Text size={15} color={theme['c-font']} style={styles.paragraph}>
            主页会放一个搜索入口、今天的听歌概况，还有你常用的歌单。听歌统计会记录每天听了多久、哪天最活跃。
          </Text>
        </IntroPage>

        <IntroPage key="i3" step={3} title="数据属于你">
          <Text size={15} color={theme['c-font']} style={styles.paragraph}>
            听歌统计默认只存在这台设备上，歌词、封面缓存和下载文件也一样。只有你主动打开数据同步，或者导入自定义音源时，应用才会去联网。
          </Text>
          <Text size={15} color={theme['c-font']} style={styles.paragraph}>
            接下来几页是基础配置，每一页都可以跳过。
          </Text>
        </IntroPage>

        <ConfigPage key="c1" step={4} title="音源导入" desc="选择默认音源接口。如果使用自定义音源,可在此处导入。">
          <Source />
        </ConfigPage>

        <ConfigPage key="c2" step={5} title="音质设置" desc="设置默认播放音质,不同音源对音质的支持范围略有差异。">
          <PlayHighQuality />
        </ConfigPage>

        <ConfigPage key="c3" step={6} title="主题设置" desc="选择界面主题、动态背景与字体阴影,让应用看起来更像你的应用。">
          <ThemeGroup />
        </ConfigPage>

        <ConfigPage key="c4" step={7} title="歌词设置" desc="设置歌词翻译、罗马音与蓝牙歌词等显示选项。">
          <LyricSettings />
        </ConfigPage>
      </PagerView>

      <View style={[styles.bottomBar, { borderTopColor: theme['c-border-background'] }]}>
        <TouchableOpacity
          style={[styles.bottomBtn, { opacity: pageIndex === 0 ? 0.35 : 1 }]}
          disabled={pageIndex === 0}
          onPress={() => goToPage(pageIndex - 1)}
        >
          <Text size={14} color={theme['c-font']}>上一步</Text>
        </TouchableOpacity>

        <View style={styles.dots}>
          {Array.from({ length: TOTAL_PAGES }, (_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                { backgroundColor: index === pageIndex ? theme['c-primary'] : theme['c-300'] },
              ]}
            />
          ))}
        </View>

        {isLast ? (
          <TouchableOpacity style={[styles.bottomBtn, styles.primaryBtn, { backgroundColor: theme['c-primary'] }]} onPress={finish}>
            <Text size={14} color="#fff">完成</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.bottomBtn, styles.primaryBtn, { backgroundColor: theme['c-primary'] }]} onPress={() => goToPage(pageIndex + 1)}>
            <Text size={14} color="#fff">下一步</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  skipTop: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pager: {
    flex: 1,
  },
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  pageStep: {
    marginBottom: 6,
  },
  pageTitle: {
    fontWeight: '800',
    marginBottom: 16,
  },
  pageDesc: {
    marginBottom: 16,
    lineHeight: 20,
  },
  pageBody: {
    marginTop: 4,
  },
  paragraph: {
    lineHeight: 24,
    marginBottom: 12,
  },
  lyricSettings: {
    gap: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  bottomBtn: {
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    borderRadius: 18,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})

export default Oobe
