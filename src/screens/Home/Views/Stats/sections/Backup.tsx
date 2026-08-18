import { memo, useCallback, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import { useTheme } from '@/store/theme/hook'
import { createStyle, handleReadFile, handleSaveFile, toast } from '@/utils/tools'
import { exportStatsData, importStatsData } from '@/core/player/stats'
import { getReportArchive, importReportArchive } from '@/core/stats/report'

const BackupSection = memo(() => {
  const theme = useTheme()
  const [chooseVisible, setChooseVisible] = useState(false)
  const choosePathRef = useRef<ChoosePathType>(null)
  const chooseActionRef = useRef<'stats-export' | 'stats-import'>('stats-export')
  const importConfirmRef = useRef<ConfirmAlertType>(null)

  const handleChooseConfirm = useCallback((path: string) => {
    const action = chooseActionRef.current
    if (action === 'stats-export') {
      void exportStatsData()
        .then(data => getReportArchive().then(archive => ({ ...data, archive })))
        .then(data => handleSaveFile(`${path}/lx_stats.lxmc`, data))
        .then(() => toast('账本数据已导出(含报告档案)'))
        .catch((err: any) => toast(`导出失败:${err?.message ?? err}`, 'long'))
    } else {
      void handleReadFile<any>(path)
        .then(data =>
          Promise.all([
            importStatsData(data),
            data.archive ? importReportArchive(data.archive) : Promise.resolve(),
          ])
        )
        .then(() => toast('账本数据已导入(含报告档案)'))
        .catch((err: any) => toast(`导入失败:${err?.message ?? err}`, 'long'))
    }
  }, [])

  const showChoose = useCallback((action: 'stats-export' | 'stats-import') => {
    chooseActionRef.current = action
    const options: { title: string; dirOnly: boolean; filter?: string[] } = {
      title: action === 'stats-export' ? '选择账本导出目录' : '选择账本备份文件',
      dirOnly: action === 'stats-export',
    }
    if (action === 'stats-import') {
      options.filter = undefined
    }
    if (chooseVisible) {
      choosePathRef.current?.show(options)
    } else {
      setChooseVisible(true)
      requestAnimationFrame(() => {
        choosePathRef.current?.show(options)
      })
    }
  }, [chooseVisible])

  return (
    <View style={[styles.section, { backgroundColor: theme['c-content-background'] }]}>
      <Text size={17} color={theme['c-font']} style={styles.title}>账本备份</Text>
      <View style={styles.btns}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme['c-primary'] }]} onPress={() => showChoose('stats-export')}>
          <Text size={13} color="#fff">导出账本</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { borderColor: theme['c-500'] }]} onPress={() => importConfirmRef.current?.setVisible(true)}>
          <Text size={13} color={theme['c-primary']}>导入账本</Text>
        </TouchableOpacity>
      </View>
      <Text size={11} color={theme['c-500']} style={styles.tip}>含每日聚合 / 歌曲维度 / 原始事件 + 报告档案，.lxmc 格式</Text>

      {chooseVisible ? <ChoosePath ref={choosePathRef} onConfirm={handleChooseConfirm} /> : null}
      <ConfirmAlert
        ref={importConfirmRef}
        title="导入账本"
        text="导入将覆盖当前全部本地统计与报告档案，确定继续吗？"
        cancelText="取消"
        confirmText="继续导入"
        bgHide={false}
        onConfirm={() => {
          importConfirmRef.current?.setVisible(false)
          showChoose('stats-import')
        }}
      />
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
  btns: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
  },
  tip: {
    marginTop: 10,
    textAlign: 'center',
  },
})

export default BackupSection
