import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle, toast } from '@/utils/tools'
import InputItem from '@/screens/Home/Views/Setting/components/InputItem'
import Button from '@/screens/Home/Views/Setting/components/Button'
import { AI_PROVIDERS, AI_TONES, testAiConnection } from '@/core/stats/ai'
import { deleteReportFromArchive, generateWeeklyReport, getReportArchive, readCachedReport, type ArchiveItem } from '@/core/stats/report'
import type { AiReportV2 } from '@/core/stats/schema'

const AiReportSection = memo(() => {
  const theme = useTheme()
  const endpoint = useSettingValue('common.aiEndpoint')
  const apiKey = useSettingValue('common.aiApiKey')
  const nickname = useSettingValue('common.aiNickname')
  const model = useSettingValue('common.aiModel')
  const tone = useSettingValue('common.aiTone')
  const [testLoading, setTestLoading] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const alertRef = useRef<ConfirmAlertType>(null)
  const deleteRef = useRef<ConfirmAlertType>(null)
  const pendingDeleteIdRef = useRef<string | null>(null)
  const [report, setReport] = useState<AiReportV2 | null>(null)
  const [archive, setArchive] = useState<ArchiveItem[]>([])
  const [expanded, setExpanded] = useState(false)

  const loadArchive = useCallback(() => {
    void getReportArchive().then(setArchive)
  }, [])

  const loadCached = useCallback(() => {
    void readCachedReport().then((cached) => {
      if (cached) setReport(cached)
    })
  }, [])

  useEffect(() => {
    loadCached()
    loadArchive()
  }, [loadCached, loadArchive])

  useEffect(() => {
    if (testResult) alertRef.current?.setVisible(true)
  }, [testResult])

  const handleChanged =
    (key: 'common.aiEndpoint' | 'common.aiApiKey' | 'common.aiNickname' | 'common.aiModel') =>
    (text: string, callback: (value: string) => void) => {
      callback(text)
      updateSetting({ [key]: text.trim() })
    }

  const handleTest = () => {
    setTestLoading(true)
    setTestResult(null)
    testAiConnection()
      .then((reply) => setTestResult({ success: true, message: reply }))
      .catch((err: any) => setTestResult({ success: false, message: err?.message ?? String(err) }))
      .finally(() => setTestLoading(false))
  }

  const handleGenerate = (force: boolean) => {
    setGenLoading(true)
    generateWeeklyReport(force)
      .then((res) => {
        if (res.ok) {
          setReport(res.report)
          loadArchive()
          toast(res.cached ? '已从缓存读取' : '报告生成成功')
        } else {
          toast(res.error, 'long')
        }
      })
      .finally(() => setGenLoading(false))
  }

  const renderReport = () => {
    if (!report) return null
    return (
      <View style={[styles.reportCard, { backgroundColor: theme['c-primary-alpha-900'] }]}>
        <View style={styles.reportHeader}>
          <Text size={16} color={theme['c-primary']} style={styles.reportTitle}>
            {report.identity?.period_name || '本周听歌报告'}
          </Text>
          <Text size={11} color={theme['c-500']}>{report.period.start} ~ {report.period.end}</Text>
        </View>
        <View style={styles.reportStats}>
          <View style={styles.reportStat}>
            <Text size={20} color={theme['c-primary']} style={styles.reportStatValue}>{report.overview.total_plays}</Text>
            <Text size={11} color={theme['c-500']}>次播放</Text>
          </View>
          <View style={styles.reportStat}>
            <Text size={20} color={theme['c-primary']} style={styles.reportStatValue}>{report.overview.total_duration_min}</Text>
            <Text size={11} color={theme['c-500']}>分钟</Text>
          </View>
          <View style={styles.reportStat}>
            <Text size={20} color={theme['c-primary']} style={styles.reportStatValue}>{report.overview.active_days}</Text>
            <Text size={11} color={theme['c-500']}>活跃天</Text>
          </View>
        </View>
        {report.overview.top_song?.name ? (
          <Text size={13} color={theme['c-font']} style={styles.reportTopSong}>
            本周最常听:《{report.overview.top_song.name}》 · {report.overview.top_song.plays} 次
          </Text>
        ) : null}
        {report.poster?.ai_copy ? (
          <Text size={13} color={theme['c-font']} style={styles.reportCopy}>
            {report.poster.ai_copy}
          </Text>
        ) : null}
        {report.insights?.length ? (
          <View style={styles.insightList}>
            {report.insights.slice(0, 3).map((insight, index) => (
              <Text key={index} size={12} color={theme['c-500']} style={styles.insightItem}>· {insight}</Text>
            ))}
          </View>
        ) : null}
      </View>
    )
  }

  const handleDeleteArchive = (id: string) => {
    pendingDeleteIdRef.current = id
    deleteRef.current?.setVisible(true)
  }

  const confirmDeleteArchive = () => {
    const id = pendingDeleteIdRef.current
    pendingDeleteIdRef.current = null
    if (!id) return
    void deleteReportFromArchive(id).then(() => {
      deleteRef.current?.setVisible(false)
      loadArchive()
      toast('报告已删除')
    })
  }

  const renderArchive = () => {
    if (!archive.length) return null
    return (
      <View style={styles.archiveWrap}>
        <Text size={13} color={theme['c-font']} style={styles.archiveTitle}>历史报告</Text>
        {archive.map((item) => (
          <View key={item.id} style={styles.archiveItem}>
            <TouchableOpacity
              style={styles.archiveMain}
              onPress={() => setReport(item.report)}
            >
              <Text size={13} color={theme['c-font']} numberOfLines={1}>
                {item.report.identity?.period_name || `${item.period.start} ~ ${item.period.end}`}
              </Text>
              <Text size={11} color={theme['c-500']} numberOfLines={1}>
                {item.period.start} ~ {item.period.end}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteArchive(item.id)}>
              <Text size={12} color={theme['c-500']}>删除</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    )
  }

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setExpanded((v) => !v)}>
        <Text size={17} color={theme['c-font']} style={styles.sectionTitle}>AI 听歌报告</Text>
        <Text size={11} color={theme['c-500']}>{expanded ? '收起 ▲' : '展开 ▼'}</Text>
      </TouchableOpacity>

      {expanded ? (
      <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
        <InputItem
          value={endpoint}
          label="Endpoint"
          onChanged={handleChanged('common.aiEndpoint')}
          placeholder="https://api.deepseek.com"
        />
        <InputItem
          value={apiKey}
          label="API Key"
          onChanged={handleChanged('common.aiApiKey')}
          placeholder="sk-..."
          secureTextEntry
        />
        <InputItem
          value={model}
          label="模型"
          onChanged={handleChanged('common.aiModel')}
          placeholder="deepseek-chat"
        />
        <InputItem
          value={nickname}
          label="称呼"
          onChanged={handleChanged('common.aiNickname')}
          placeholder="你"
        />

        <Text size={13} color={theme['c-font']} style={styles.toneLabel}>语气</Text>
        <View style={styles.toneList}>
          {AI_TONES.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.toneChip,
                {
                  backgroundColor: tone === item.id ? theme['c-primary'] : 'transparent',
                  borderColor: tone === item.id ? theme['c-primary'] : theme['c-border-background'],
                },
              ]}
              onPress={() => updateSetting({ 'common.aiTone': item.id })}
            >
              <Text size={12} color={tone === item.id ? '#fff' : theme['c-font']}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text size={13} color={theme['c-font']} style={styles.toneLabel}>服务商预设</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.providerScroll}>
          <View style={styles.providerRow}>
            {AI_PROVIDERS.map((provider) => (
              <TouchableOpacity
                key={provider.id}
                style={[styles.providerChip, { borderColor: theme['c-border-background'] }]}
                onPress={() => {
                  updateSetting({
                    'common.aiEndpoint': provider.endpoint,
                    'common.aiModel': provider.model,
                  })
                  toast(`${provider.name} 已填入`)
                }}
              >
                <Text size={12} color={theme['c-primary']}>{provider.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.btnRow}>
          <Button onPress={handleTest} disabled={testLoading}>
            {testLoading ? '测试中…' : '测试连接'}
          </Button>
          <Button onPress={() => handleGenerate(false)} disabled={genLoading}>
            {genLoading ? '生成中…' : '生成报告'}
          </Button>
          <Button onPress={() => handleGenerate(true)} disabled={genLoading}>
            强制重生成
          </Button>
        </View>

        {renderReport()}
        {renderArchive()}
      </View>
      ) : null}

      <ConfirmAlert
        ref={alertRef}
        title={testResult?.success ? '连接成功' : '连接失败'}
        text={testResult?.message ?? ''}
        cancelText="确定"
        showConfirm={false}
        bgHide={false}
        onCancel={() => setTestResult(null)}
      />
      <ConfirmAlert
        ref={deleteRef}
        title="删除报告"
        text="确定删除这份历史报告吗?删除后不可恢复。"
        cancelText="取消"
        confirmText="删除"
        bgHide={false}
        onConfirm={confirmDeleteArchive}
        onCancel={() => {
          pendingDeleteIdRef.current = null
        }}
      />
    </View>
  )
})

const styles = createStyle({
  wrapper: {
    marginBottom: 16,
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
  card: {
    borderRadius: 20,
    padding: 12,
  },
  toneLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontWeight: '600',
  },
  toneList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toneChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  providerScroll: {
    marginBottom: 4,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  providerChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  btnRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  reportCard: {
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reportTitle: {
    fontWeight: '700',
  },
  reportStats: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  reportStat: {
    flex: 1,
    alignItems: 'center',
  },
  reportStatValue: {
    fontWeight: '800',
  },
  reportTopSong: {
    marginBottom: 6,
  },
  reportCopy: {
    lineHeight: 20,
  },
  insightList: {
    marginTop: 8,
  },
  insightItem: {
    lineHeight: 18,
  },
  archiveWrap: {
    marginTop: 12,
  },
  archiveTitle: {
    fontWeight: '600',
    marginBottom: 6,
  },
  archiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  archiveMain: {
    flex: 1,
    marginRight: 8,
  },
})

export default AiReportSection
