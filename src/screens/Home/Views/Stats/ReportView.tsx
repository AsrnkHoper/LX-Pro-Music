/**
 * 报告展示容器(功能块③)—— 全屏 Modal 展示故事流翻卡
 * - 「查看本周报告」入口:读 @stats_report 缓存,有则展示;无则提示先生成
 * - 生成中三态等待(策划:正在读你的数据 → 正在写你的一周 → 正在装信)
 * - 展示:StoryFlow 翻卡
 */
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Modal, ScrollView, TouchableOpacity, View } from 'react-native'
import { useWindowSize } from '@/utils/hooks'
import { createStyle, toast } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import StoryFlow from './StoryFlow'
import { readCachedReport, generateWeeklyReport, getReportArchive, type ArchiveItem } from '@/core/stats/report'
import type { AiReportV2 } from '@/core/stats/schema'

/** 全屏报告查看器(ref 控制开关 + 展示报告) */
export interface ReportViewerType {
  setVisible: (visible: boolean) => void
  /** 展示指定报告(有报告直接展示) */
  show: (report: AiReportV2) => void
  /** 打开报告档案馆(历史报告列表) */
  openArchive: () => void
  /** 打开全屏页并立即生成(带进度条) */
  generate: () => void
}

export default memo(
  forwardRef<ReportViewerType, {}>((_, ref) => {
    const theme = useTheme()
    const { height: windowHeight } = useWindowSize()
    const [visible, setVisible] = useState(false)
    const [report, setReport] = useState<AiReportV2 | null>(null)
    const [archive, setArchive] = useState<ArchiveItem[]>([])
    const [viewMode, setViewMode] = useState<'report' | 'archive'>('report')
    const [generating, setGenerating] = useState(false)
    const [genStage, setGenStage] = useState(0)
    const [waitSeconds, setWaitSeconds] = useState(0)
    // 无限循环进度条动画
    const barAnim = useRef(new Animated.Value(0)).current
    useEffect(() => {
      if (!generating) return
      barAnim.setValue(0)
      const loop = Animated.loop(
        Animated.timing(barAnim, { toValue: 1, duration: 1800, useNativeDriver: false })
      )
      loop.start()
      return () => loop.stop()
    }, [generating, barAnim])
    const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['10%', '100%'] })

    const show = useCallback((r: AiReportV2) => {
      setReport(r)
      setViewMode('report')
      setVisible(true)
    }, [])

    /** 打开报告档案馆(读历史报告列表) */
    const openArchive = useCallback(() => {
      void getReportArchive().then((list) => {
        setArchive(list)
        setViewMode('archive')
        setVisible(true)
      })
    }, [])

    /** 生成本周报告(带真实进度反馈:已等待秒数 + 循环进度条 + 三态) */
    const handleGenerate = useCallback(() => {
      setGenerating(true)
      setGenStage(0)
      setWaitSeconds(0)
      // 三态:读数据(0)→ 写一周(1)→ 装信(2),各约 1.5s 轮转
      const stageTimer = setInterval(() => {
        setGenStage((s) => (s + 1) % 3)
      }, 1500)
      // 已等待秒数计时
      const secTimer = setInterval(() => {
        setWaitSeconds((s) => s + 1)
      }, 1000)
      generateWeeklyReport()
        .then((res) => {
          if (res.ok) {
            setReport(res.report)
            if (!visible) setVisible(true)
          } else {
            toast(res.error)
          }
        })
        .finally(() => {
          clearInterval(stageTimer)
          clearInterval(secTimer)
          setGenerating(false)
        })
    }, [visible])

    /** 打开全屏页并立即开始生成(带进度条反馈) */
    const generate = useCallback(() => {
      setReport(null)
      setViewMode('report')
      setVisible(true)
      handleGenerate()
    }, [handleGenerate])

    useImperativeHandle(ref, () => ({
      setVisible,
      show,
      openArchive,
      generate,
    }))

    const genTexts = ['正在读你的数据…', '正在写你的一周…', '正在装信…']

    return (
      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Text size={14} color={theme['c-primary']}>← 返回</Text>
            </TouchableOpacity>
            <Text size={16} color={theme['c-font']} style={styles.headerTitle}>
              {viewMode === 'archive' ? '报告档案馆' : '听歌报告'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (viewMode === 'archive') {
                  setViewMode('report')
                } else {
                  openArchive()
                }
              }}
            >
              <Text size={13} color={theme['c-primary']}>{viewMode === 'archive' ? '当前报告' : '报告档案馆'}</Text>
            </TouchableOpacity>
          </View>

          {generating ? (
            <View style={styles.generating}>
              <ActivityIndicator size="large" color={theme['c-primary']} />
              <Text size={15} color={theme['c-font']} style={styles.genText}>{genTexts[genStage]}</Text>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressBar, { width: barWidth, backgroundColor: theme['c-primary'] }]} />
              </View>
              <Text size={12} color={theme['c-500']} style={styles.genWait}>
                已等待 {waitSeconds} 秒,AI 正在分析你的听歌数据…
              </Text>
            </View>
          ) : viewMode === 'archive' ? (
            <ScrollView style={styles.archiveList}>
              {archive.length === 0 ? (
                <View style={styles.empty}>
                  <Text size={15} color={theme['c-500']} style={styles.emptyText}>档案馆还是空的</Text>
                  <Text size={13} color={theme['c-500']} style={styles.emptySub}>
                    生成一份本周报告后,它会自动存档在这里,离线也能回看
                  </Text>
                </View>
              ) : (
                archive.map((item) => (
                  <TouchableOpacity
                    key={`${item.period.start}_${item.generatedAt}`}
                    style={[styles.archiveItem, { borderBottomColor: theme['c-border-background'] }]}
                    onPress={() => {
                      setReport(item.report)
                      setViewMode('report')
                    }}
                  >
                    <View style={styles.archiveItemMain}>
                      <Text size={15} color={theme['c-font']}>{item.report.identity?.period_name || `${item.period.start} ~ ${item.period.end}`}</Text>
                      <Text size={12} color={theme['c-500']} style={styles.archiveSub}>
                        {item.period.start} ~ {item.period.end}
                      </Text>
                    </View>
                    <Text size={12} color={theme['c-500']}>
                      {item.report.overview.total_plays}次
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          ) : report ? (
            <StoryFlow report={report} />
          ) : (
            <View style={styles.empty}>
              <Text size={15} color={theme['c-500']} style={styles.emptyText}>
                还没有本周报告
              </Text>
              <Text size={13} color={theme['c-500']} style={styles.emptySub}>
                先点「生成本周报告」,AI 会分析你的听歌数据写一封专属的信
              </Text>
              <TouchableOpacity
                style={[styles.genBtn, { backgroundColor: theme['c-primary'] }]}
                onPress={handleGenerate}
              >
                <Text size={15} color="#FFFFFF">生成本周报告</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    )
  })
)

const styles = createStyle({
  container: {
    flex: 1,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  generating: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genText: {
    marginTop: 16,
    marginBottom: 24,
  },
  progressTrack: {
    width: '70%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.2)',
    overflow: 'hidden',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  genWait: {
    marginTop: 12,
  },
  archiveList: {
    flex: 1,
  },
  archiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  archiveItemMain: {
    flex: 1,
    marginRight: 8,
  },
  archiveSub: {
    marginTop: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySub: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  genBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
})
