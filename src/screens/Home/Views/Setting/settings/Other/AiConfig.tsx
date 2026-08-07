import { memo, useRef, useState } from 'react'
import { View } from 'react-native'

import InputItem, { type InputItemProps } from '../../components/InputItem'
import Button from '../../components/Button'
import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import Text from '@/components/common/Text'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { updateSetting } from '@/core/common'
import { createStyle, toast } from '@/utils/tools'
import { AI_TONES, AI_PROVIDERS, testAiConnection } from '@/core/stats/ai'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const endpoint = useSettingValue('common.aiEndpoint')
  const apiKey = useSettingValue('common.aiApiKey')
  const nickname = useSettingValue('common.aiNickname')
  const model = useSettingValue('common.aiModel')
  const tone = useSettingValue('common.aiTone')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const resultRef = useRef<ConfirmAlertType>(null)

  const handleChanged =
    (key: 'common.aiEndpoint' | 'common.aiApiKey' | 'common.aiNickname' | 'common.aiModel'): InputItemProps['onChanged'] =>
    (text, callback) => {
      callback(text)
      updateSetting({ [key]: text.trim() })
    }

  const handleTestConnection = () => {
    setTesting(true)
    testAiConnection({ endpoint, apiKey, model })
      .then((reply) => {
        setTestResult({ success: true, message: reply })
      })
      .catch((err: Error) => {
        setTestResult({ success: false, message: `${t('setting_other_ai_test_fail_prefix')}${err?.message ?? err}` })
      })
      .finally(() => {
        setTesting(false)
        resultRef.current?.setVisible(true)
      })
  }

  const handleTryGenerate = () => {
    toast(t('setting_other_ai_try_tip'))
  }

  return (
    <SubTitle title={t('setting_other_ai')}>
      <Text size={12} color={theme['c-500']}>
        {t('setting_other_ai_tip')}
      </Text>
      <InputItem
        value={endpoint}
        label={t('setting_other_ai_endpoint')}
        onChanged={handleChanged('common.aiEndpoint')}
        placeholder={t('setting_other_ai_endpoint_placeholder')}
      />
      <InputItem
        value={apiKey}
        label={t('setting_other_ai_api_key')}
        onChanged={handleChanged('common.aiApiKey')}
        placeholder={t('setting_other_ai_api_key_placeholder')}
        secureTextEntry
      />
      <InputItem
        value={nickname}
        label={t('setting_other_ai_nickname')}
        onChanged={handleChanged('common.aiNickname')}
        placeholder={t('setting_other_ai_nickname_placeholder')}
      />
      <InputItem
        value={model}
        label={t('setting_other_ai_model')}
        onChanged={handleChanged('common.aiModel')}
        placeholder={t('setting_other_ai_model_placeholder')}
      />

      <View style={styles.toneWrap}>
        <Text size={14}>{t('setting_other_ai_tone')}</Text>
        <View style={styles.toneList}>
          {AI_TONES.map((toneItem) => (
            <CheckBox
              key={toneItem.id}
              check={tone === toneItem.id}
              label={toneItem.name}
              onChange={() => {
                updateSetting({ 'common.aiTone': toneItem.id })
              }}
              need
              marginRight={8}
            />
          ))}
        </View>
      </View>

      <View style={styles.providerWrap}>
        <Text size={14}>{t('setting_other_ai_provider')}</Text>
        {AI_PROVIDERS.map((provider) => (
          <View key={provider.id} style={styles.providerRow}>
            <Text style={styles.providerName} size={14}>
              {provider.name}
            </Text>
            <Text style={styles.providerEndpoint} size={12} numberOfLines={1}>
              {provider.endpoint}
            </Text>
            <Button
              onPress={() => {
                updateSetting({
                  'common.aiEndpoint': provider.endpoint,
                  'common.aiModel': provider.model,
                })
                toast(`${provider.name}${t('setting_other_ai_provider_filled')}`)
              }}
            >
              {t('setting_other_ai_provider_apply')}
            </Button>
          </View>
        ))}
        <Text size={12} color={theme['c-500']}>
          {t('setting_other_ai_provider_tip')}
        </Text>
      </View>

      <View style={styles.btnContainer}>
        <Button onPress={handleTestConnection} disabled={testing}>
          {testing ? t('setting_other_ai_testing') : t('setting_other_ai_test_btn')}
        </Button>
        <Button onPress={handleTryGenerate}>{t('setting_other_ai_try_btn')}</Button>
      </View>

      {/* 测试连接结果弹窗(项目 UI,滞留时间足够) */}
      <ConfirmAlert
        ref={resultRef}
        title={testResult?.success ? t('setting_other_ai_test_success') : t('setting_other_ai_test_fail')}
        text={testResult?.message ?? ''}
        confirmText="确定"
        showConfirm
        bgHide={false}
      />
    </SubTitle>
  )
})

const styles = createStyle({
  toneWrap: {
    marginBottom: 15,
  },
  toneList: {
    marginTop: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  providerWrap: {
    marginBottom: 10,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  providerName: {
    width: 130,
  },
  providerEndpoint: {
    flexGrow: 1,
    flexShrink: 1,
    marginRight: 8,
    opacity: 0.6,
  },
  btnContainer: {
    marginBottom: 5,
    paddingLeft: 20,
    flexDirection: 'row',
  },
})
