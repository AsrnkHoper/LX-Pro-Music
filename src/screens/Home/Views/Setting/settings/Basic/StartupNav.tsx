import { memo, useMemo } from 'react'
import { View } from 'react-native'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { NAV_MENUS } from '@/config/constant'
import { createStyle } from '@/utils/tools'

const STARTUP_NAV_IDS = NAV_MENUS.filter((menu) => menu.id !== 'nav_play_history').map((menu) => menu.id)

export default memo(() => {
  const t = useI18n()
  const startupNavId = useSettingValue('common.startupNavId')
  const list = useMemo(() => STARTUP_NAV_IDS.map((id) => ({ id, name: t(id) })), [t])

  return (
    <View style={styles.list}>
      {list.map(({ id, name }) => (
        <CheckBox
          key={id}
          check={startupNavId === id}
          label={name}
          onChange={() => {
            updateSetting({ 'common.startupNavId': id })
          }}
          need
        />
      ))}
    </View>
  )
})

const styles = createStyle({
  list: {
    marginTop: 5,
  },
})
