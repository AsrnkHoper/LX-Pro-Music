/**
 * 报告展示容器(功能块③)—— 全屏 Modal 展示故事流翻卡
 * - 「查看本周报告」入口:读 @stats_report 缓存,有则展示;无则提示先生成
 * - 生成中三态等待(策划:正在读你的数据 → 正在写你的一周 → 正在装信)
 * - 展示:StoryFlow 翻卡
 */
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Modal, ScrollView, TouchableOpacity, View } from 'react-native'
import { useWindowSize } from '@/utils/hooks'
import { createStyle, handleReadFile, handleSaveFile, toast } from '@/utils/tools'
import Text from '@/components/common/Text'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import { useTheme } from '@/store/theme/hook'
import StoryFlow from './StoryFlow'
import { deleteReportFromArchive, generateWeeklyReport, getReportArchive, importReportArchive, readCachedReport, type ArchiveItem } from '@/core/stats/report'
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
    const [chooseVisible, setChooseVisible] = useState(false)
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
    const choosePathRef = useRef<ChoosePathType>(null)
    const chooseActionRef = useRef<'archive-export' | 'archive-import'>('archive-export')
    const deleteConfirmRef = useRef<ConfirmAlertType>(null)
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

    /** 刷新档案馆列表 */
    const refreshArchive = useCallback(() => {
      void getReportArchive().then(setArchive)
    }, [])

    const handleChooseConfirm = useCallback((path: string) => {
      const action = chooseActionRef.current
      if (action === 'archive-export') {
        void getReportArchive()
          .then((list) => handleSaveFile(`${path}/lx_report_archive.lxmc`, list))
          .then(() => toast('报告档案已导出'))
          .catch((err: any) => toast(`导出失败:${err?.message ?? err}`, 'long'))
      } else {
        void handleReadFile<ArchiveItem[]>(path)
          .then((data) => importReportArchive(data))
          .then(() => refreshArchive())
          .then(() => toast('报告档案已导入'))
          .catch((err: any) => toast(`导入失败:${err?.message ?? err}`, 'long'))
      }
    }, [refreshArchive])

    const showChoose = useCallback(
      (action: 'archive-export' | 'archive-import') => {
        chooseActionRef.current = action
        const options = {
          title: action === 'archive-export' ? '选择报告档案导出目录' : '选择报告档案文件',
          dirOnly: action === 'archive-export',
          filter: ['lxmc', 'json'],
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

    const handleDeleteArchive = useCallback((id: string) => {
      setPendingDeleteId(id)
      deleteConfirmRef.current?.setVisible(true)
    }, [])

    /** 生成本周报告(带真实进度反馈:已等待秒数 + 循环进度条 + 三态) */
    const handleGenerate = useCallback((force = false) => {
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
      generateWeeklyReport(force)
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

    /** 打开全屏页并立即开始生成(带进度条反馈;force=true 强制重新请求 AI,不用缓存) */
    const generate = useCallback(() => {
      setReport(null)
      setViewMode('report')
      setVisible(true)
      handleGenerate(true) // 试生成:强制重新请求 AI,不用缓存
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
              <Text size={11} color={theme['c-500']} style={styles.genWait}>
                推理模型生成较慢,通常需要 1-3 分钟,请耐心等待
              </Text>
            </View>
          ) : viewMode === 'archive' ? (
            <View style={styles.archiveWrap}>
              <View style={styles.archiveToolbar}>
                <TouchableOpacity style={styles.archiveToolBtn} onPress={() => showChoose('archive-export')}>
                  <Text size={13} color={theme['c-primary']}>导出档案</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.archiveToolBtn} onPress={() => showChoose('archive-import')}>
                  <Text size={13} color={theme['c-primary']}>导入档案</Text>
                </TouchableOpacity>
              </View>
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
                    <View
                      key={item.id || `${item.period.start}_${item.generatedAt}`}
                      style={[styles.archiveItem, { borderBottomColor: theme['c-border-background'] }]}
                    >
                      <TouchableOpacity
                        style={styles.archiveItemTouch}
                        onPress={() => {
                          setReport(item.report)
                          setViewMode('report')
                        }}
                      >
                        <View style={styles.archiveItemMain}>
                          <Text size={15} color={theme['c-font']}>{item.report.identity?.period_name || `${item.period.start} ~ ${item.period.end}`}</Text>
                          <Text size={12} color={theme['c-500']} style={styles.archiveSub}>
                            {item.period.start} ~ {item.period.end}
                            {item.generatedAt ? ` · ${new Date(item.generatedAt).toLocaleDateString()} ${new Date(item.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </Text>
                        </View>
                        <Text size={12} color={theme['c-500']}>
                          {item.report.overview.total_plays}次
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.archiveDeleteBtn}
                        onPress={() => handleDeleteArchive(item.id)}
                      >
                        <Text size={12} color={theme['c-500']}>删除</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          ) : report ? (
            <StoryFlow report={report} onRegeneratePoster={() => handleGenerate(true)} />
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
                onPress={() => handleGenerate(true)}
              >
                <Text size={15} color="#FFFFFF">生成本周报告</Text>
              </TouchableOpacity>
            </View>
          )}
          {chooseVisible ? <ChoosePath ref={choosePathRef} onConfirm={handleChooseConfirm} /> : null}
          <ConfirmAlert
            ref={deleteConfirmRef}
            title="删除报告"
            text="确定删除这份报告吗?删除后不可恢复"
            cancelText="取消"
            confirmText="删除"
            bgHide={false}
            onConfirm={() => {
              const id = pendingDeleteId
              if (!id) return
              void deleteReportFromArchive(id)
                .then(() => refreshArchive())
                .then(() => toast('报告已删除'))
                .catch((err: any) => toast(`删除失败:${err?.message ?? err}`, 'long'))
            }}
          />
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
  archiveWrap: {
    flex: 1,
  },
  archiveToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  archiveToolBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(128,128,128,0.4)',
  },
  archiveList: {
    flex: 1,
  },
  archiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  archiveItemTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  archiveDeleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
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
