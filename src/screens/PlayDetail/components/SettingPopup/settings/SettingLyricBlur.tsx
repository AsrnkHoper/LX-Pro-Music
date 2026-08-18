import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import CheckBox from '@/components/common/CheckBox'
import styles from './style'

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const isShowLyricBlur = useSettingValue('playDetail.style.lyricBlur')
  const setShowLyricBlur = (showLyricBlur: boolean) => {
    updateSetting({ 'playDetail.style.lyricBlur': showLyricBlur })
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <CheckBox
          marginBottom={3}
          check={isShowLyricBlur}
          label={t('play_detail_setting_lyric_blur')}
          onChange={setShowLyricBlur}
        />
      </View>
      <Text size={11} color={theme['c-font-label']}>{t('play_detail_setting_lyric_blur_tip')}</Text>
    </View>
  )
}
