import { storageDataPrefix, storageDataPrefixOld } from '@/config/constant'
import defaultSetting from '@/config/defaultSetting'
import { getData, removeData, saveData } from '@/plugins/storage'
import migrateSetting from './migrateSetting'
import settingState from '@/store/setting/state'
import { migrateMetaData, migrateListData } from './migrate'
import { exitApp, tipDialog } from '@/utils/tools'

// 业务相关工具方法

const primitiveType = ['string', 'boolean', 'number']
const checkPrimitiveType = (val: any): boolean => val === null || primitiveType.includes(typeof val)

const arraysEqual = (a: any[], b: any[]): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

const mergeSetting = (
  originSetting: LX.AppSetting,
  targetSetting?: Partial<LX.AppSetting> | null
): {
  setting: LX.AppSetting
  updatedSettingKeys: Array<keyof LX.AppSetting>
  updatedSetting: Partial<LX.AppSetting>
} => {
  let originSettingCopy: LX.AppSetting = { ...originSetting }
  const updatedSettingKeys: Array<keyof LX.AppSetting> = []
  const updatedSetting: Partial<LX.AppSetting> = {}

  if (targetSetting) {
    const originSettingKeys = Object.keys(originSettingCopy)
    const targetSettingKeys = Object.keys(targetSetting)

    const processKey = (key: keyof LX.AppSetting) => {
      const targetValue: any = targetSetting[key]
      const isPrimitive = checkPrimitiveType(targetValue)
      let shouldSkip = false
      
      // 非基本类型且不是 navStatus 或 navOrder，跳过
      if (!isPrimitive && key !== 'common.navStatus' && key !== 'common.navOrder') {
        shouldSkip = true
      } 
      // 如果是 navStatus 或 navOrder
      else if (key === 'common.navStatus' || key === 'common.navOrder') {
        // 如果目标值和原始值都是数组
        if (Array.isArray(targetValue) && Array.isArray(originSettingCopy[key])) {
          // 比较数组内容
          if (arraysEqual(targetValue, originSettingCopy[key])) {
            shouldSkip = true
          }
        } 
        // 如果其中一个不是数组，使用原始相等比较
        else if (targetValue == originSettingCopy[key]) {
          shouldSkip = true
        }
      } 
      // 基本类型的比较
      else if (targetValue == originSettingCopy[key]) {
        shouldSkip = true
      }
      
      // 如果原始值是 undefined 但目标值不是，我们不应该跳过，应该添加这个键
      // 只有当两个值都是 undefined 或者相等时才跳过

      if (!shouldSkip) {
        updatedSettingKeys.push(key)
        updatedSetting[key] = targetValue
        // @ts-expect-error
        originSettingCopy[key] = targetValue
      }
    }

    if (originSettingKeys.length > targetSettingKeys.length) {
      for (const key of targetSettingKeys as Array<keyof LX.AppSetting>) {
        processKey(key)
      }
    } else {
      for (const key of originSettingKeys as Array<keyof LX.AppSetting>) {
        if (targetSetting[key] !== undefined) {
          processKey(key)
        }
      }
    }
  }

  return {
    setting: originSettingCopy,
    updatedSettingKeys,
    updatedSetting,
  }
}
export const updateSetting = (setting?: Partial<LX.AppSetting> | null, isInit: boolean = false) => {
  let originSetting: LX.AppSetting
  if (isInit) {
    originSetting = { ...defaultSetting }
  } else originSetting = settingState.setting

  const result = mergeSetting(originSetting, setting)

  result.setting.version = defaultSetting.version

  return result
}

export const initSetting = async () => {
  let setting: Partial<LX.AppSetting> | null = await getData(storageDataPrefix.setting)

  // 补齐后续版本新增的导航项,避免老用户已保存的设置里没有 nav_stats 等新入口
  if (setting) {
    const savedOrder = setting['common.navOrder']
    if (Array.isArray(savedOrder)) {
      const nextOrder = [...savedOrder]
      for (const id of defaultSetting['common.navOrder']) {
        if (!nextOrder.includes(id)) nextOrder.push(id)
      }
      setting['common.navOrder'] = nextOrder
    }
    setting['common.navStatus'] = {
      ...defaultSetting['common.navStatus'],
      ...(setting['common.navStatus'] ?? {}),
    }
  }

  // try migrate setting before v1
  if (!setting) {
    const config = await getData<{ setting?: any }>(storageDataPrefixOld.setting)
    if (config != null) {
      setting = migrateSetting(config)
      try {
        await migrateListData()
        await migrateMetaData()
      } catch (err: any) {
        void tipDialog({
          title: '数据迁移失败 (Failed to migrate data)',
          message: `请截图并在 GitHub 反馈。为了防止数据丢失，应用将停止运行。错误信息：\n${(err.stack ?? err.message) as string}`,
          btnText: 'Exit',
          bgClose: false,
        }).then(() => {
          exitApp()
        })
        throw err
      }
      await removeData(storageDataPrefixOld.setting)
    }
  }

  // console.log(setting)
  const updatedSetting = updateSetting(setting, true)
  void saveData(storageDataPrefix.setting, updatedSetting.setting)

  return updatedSetting
}
