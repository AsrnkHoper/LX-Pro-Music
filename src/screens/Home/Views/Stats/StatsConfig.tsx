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
        <Text size={13} color={theme['c-font']} style={styles.priorityLabel}>统计方式</Text>
        <Text size={11} color={theme['c-500']} style={styles.priorityDesc}>
          仅秒数:只看最低计入秒数;仅比例:只看最低播放比例;都满足:两个条件都达标才计入
        </Text>
        <View style={styles.priorityRow}>
          <TouchableOpacity
            style={[styles.priorityChip, { borderColor: priority === 'time' ? theme['c-primary'] : theme['c-border-background'] }]}
            onPress={() => updateSetting({ 'stats.priority': 'time' })}
          >
            <Text size={13} color={priority === 'time' ? theme['c-primary'] : theme['c-font']}>仅秒数</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.priorityChip, { borderColor: priority === 'ratio' ? theme['c-primary'] : theme['c-border-background'] }]}
            onPress={() => updateSetting({ 'stats.priority': 'ratio' })}
          >
            <Text size={13} color={priority === 'ratio' ? theme['c-primary'] : theme['c-font']}>仅比例</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.priorityChip, { borderColor: priority === 'timeFirst' || priority === 'ratioFirst' ? theme['c-primary'] : theme['c-border-background'] }]}
            onPress={() => updateSetting({ 'stats.priority': priority === 'timeFirst' || priority === 'ratioFirst' ? priority : 'timeFirst' })}
          >
            <Text size={13} color={priority === 'timeFirst' || priority === 'ratioFirst' ? theme['c-primary'] : theme['c-font']}>都满足</Text>
          </TouchableOpacity>
        </View>
        {priority === 'timeFirst' || priority === 'ratioFirst' ? (
          <View style={styles.priorityOrderBlock}>
            <Text size={12} color={theme['c-font']} style={styles.priorityOrderLabel}>优先检查</Text>
            <View style={styles.priorityRow}>
              <TouchableOpacity
                style={[styles.priorityChip, { borderColor: priority === 'timeFirst' ? theme['c-primary'] : theme['c-border-background'] }]}
                onPress={() => updateSetting({ 'stats.priority': 'timeFirst' })}
              >
                <Text size={13} color={priority === 'timeFirst' ? theme['c-primary'] : theme['c-font']}>秒数</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.priorityChip, { borderColor: priority === 'ratioFirst' ? theme['c-primary'] : theme['c-border-background'] }]}
                onPress={() => updateSetting({ 'stats.priority': 'ratioFirst' })}
              >
                <Text size={13} color={priority === 'ratioFirst' ? theme['c-primary'] : theme['c-font']}>比例</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
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
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityOrderBlock: {
    marginTop: 10,
  },
  priorityOrderLabel: {
    fontWeight: '600',
    marginBottom: 6,
  },
  priorityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
})

export default StatsConfig
