import { memo, useCallback, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast, handleSaveFile, handleReadFile } from '@/utils/tools'
import { clearStats, exportStatsData, importStatsData } from '@/core/player/stats'

type Action = 'export' | 'import' | 'clear'

const DataManager = memo(() => {
  const theme = useTheme()
  const chooseRef = useRef<ChoosePathType>(null)
  const actionRef = useRef<Action>('export')
  const clearConfirmRef = useRef<ConfirmAlertType>(null)
  const [chooseVisible, setChooseVisible] = useState(false)

  const showChoose = useCallback((action: Action) => {
    actionRef.current = action
    const options = {
      title: action === 'export' ? '选择统计导出目录' : '选择统计备份文件',
      dirOnly: action === 'export',
      forceInternal: action === 'import',
    }
    if (chooseVisible) {
      chooseRef.current?.show(options)
    } else {
      setChooseVisible(true)
      requestAnimationFrame(() => {
        chooseRef.current?.show(options)
      })
    }
  }, [chooseVisible])

  const handleChooseConfirm = useCallback((path: string) => {
    const action = actionRef.current
    if (action === 'export') {
      void exportStatsData()
        .then((data) => handleSaveFile(`${path}/lx_stats.lxmc`, data))
        .then(() => toast('统计数据已导出'))
        .catch((err: any) => toast(`导出失败:${err?.message ?? err}`, 'long'))
    } else if (action === 'import') {
      void handleReadFile<ReturnType<typeof exportStatsData>>(path)
        .then((data) => importStatsData(data))
        .then(() => toast('统计数据已导入'))
        .catch((err: any) => toast(`导入失败:${err?.message ?? err}`, 'long'))
    }
  }, [])

  const handleClear = useCallback(() => {
    clearConfirmRef.current?.setVisible(true)
  }, [])

  const confirmClear = useCallback(() => {
    clearConfirmRef.current?.setVisible(false)
    void clearStats()
      .then(() => toast('统计数据已清空'))
      .catch((err: any) => toast(`清空失败:${err?.message ?? err}`, 'long'))
  }, [])

  return (
    <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
      <Text size={15} color={theme['c-font']} style={styles.title}>统计数据管理</Text>
      <Text size={11} color={theme['c-500']} style={styles.desc}>
        备份文件包含每日聚合、歌曲维度与原始播放事件
      </Text>
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btn} onPress={() => showChoose('export')}>
          <Text size={13} color="#fff">导出数据</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => showChoose('import')}>
          <Text size={13} color={theme['c-primary']}>导入数据</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleClear}>
          <Text size={13} color="#fff">清空数据</Text>
        </TouchableOpacity>
      </View>
      {chooseVisible ? <ChoosePath ref={chooseRef} onConfirm={handleChooseConfirm} /> : null}
      <ConfirmAlert
        ref={clearConfirmRef}
        title="清空统计数据"
        text="确定清空全部听歌统计数据吗?此操作不可恢复,建议先导出备份。"
        cancelText="取消"
        confirmText="清空"
        bgHide={false}
        onConfirm={confirmClear}
      />
    </View>
  )
})

const styles = createStyle({
  card: {
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    marginBottom: 4,
  },
  desc: {
    marginBottom: 10,
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#0f172a',
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4daf7c',
  },
  btnDanger: {
    backgroundColor: '#ef4444',
  },
})

export default DataManager
