import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import InputItem from '@/screens/Home/Views/Setting/components/InputItem'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle, toast } from '@/utils/tools'

const StatsConfig = memo(() => {
  const theme = useTheme()
  const minPlayTime = useSettingValue('stats.minPlayTime')
  const minPlayRatio = useSettingValue('stats.minPlayRatio')
  const priority = useSettingValue('stats.priority')

  const handleTimeChanged = (_text: string, callback: (value: string) => void) => {
    callback(_text)
    const value = parseInt(_text, 10)
    if (!value || value <= 0) {
      toast('请输入大于 0 的秒数')
      return
    }
    updateSetting({ 'stats.minPlayTime': value })
  }

  const handleRatioChanged = (_text: string, callback: (value: string) => void) => {
    callback(_text)
    const value = parseInt(_text, 10)
    if (!value || value <= 0 || value > 100) {
      toast('请输入 1-100 之间的百分比')
      return
    }
    updateSetting({ 'stats.minPlayRatio': value })
  }

  return (
    <View style={[styles.card, { backgroundColor: theme['c-primary-background'] }]}>
      <Text size={15} color={theme['c-font']} style={styles.title}>统计口径</Text>
      <Text size={11} color={theme['c-500']} style={styles.desc}>
        低于阈值的单曲连续播放不计入统计,也不会加入播放历史
      </Text>
      <InputItem
        value={String(minPlayTime)}
        label="最低计入秒数"
        onChanged={handleTimeChanged}
        placeholder="30"
      />
      <InputItem
        value={String(minPlayRatio)}
        label="最低播放比例(%)"
        onChanged={handleRatioChanged}
        placeholder="50"
      />
      <View style={styles.priorityBlock}>
        <Text size={13} color={theme['c-font']} style={styles.priorityLabel}>统计优先级</Text>
        <Text size={11} color={theme['c-500']} style={styles.priorityDesc}>
          秒数优先:短歌需听完,普通歌需同时满足秒数与比例;比例优先:播放比例达标即计入
        </Text>
        <View style={styles.priorityRow}>
          <TouchableOpacity
            style={[styles.priorityChip, { borderColor: priority === 'time' ? theme['c-primary'] : theme['c-border-background'] }]}
            onPress={() => updateSetting({ 'stats.priority': 'time' })}
          >
            <Text size={13} color={priority === 'time' ? theme['c-primary'] : theme['c-font']}>秒数优先</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.priorityChip, { borderColor: priority === 'ratio' ? theme['c-primary'] : theme['c-border-background'] }]}
            onPress={() => updateSetting({ 'stats.priority': 'ratio' })}
          >
            <Text size={13} color={priority === 'ratio' ? theme['c-primary'] : theme['c-font']}>比例优先</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    marginBottom: 6,
  },
  priorityBlock: {
    marginTop: 4,
  },
  priorityLabel: {
    fontWeight: '600',
    marginBottom: 2,
  },
  priorityDesc: {
    marginBottom: 8,
    lineHeight: 16,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
})

export default StatsConfig
