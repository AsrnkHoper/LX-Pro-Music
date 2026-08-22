import '@/utils/errorHandle'
import { init as initLog } from '@/utils/log'
import { bootLog, getBootLog } from '@/utils/bootLog'
import '@/config/globalData'
import { toast } from '@/utils/tools'
import { getFontSize } from '@/utils/data'
import { exitApp } from './utils/nativeModules/utils'
import { windowSizeTools } from './utils/windowSizeTools'
import { getTimeGreeting } from './utils/timeGreeting'
import { listenLaunchEvent } from './navigation/regLaunchedEvent'
import { tipDialog } from './utils/tools'
import settingState from '@/store/setting/state'
import { initWebDAVLog } from '@/core/webdavMusic/logger'

// --- START: CONSOLE LOG PATCH (v2) ---
if (__DEV__) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  const PREFIX = '###RN_DEBUG_START###';
  const SUFFIX = '###RN_DEBUG_END###';

  /**
   * @param {'log' | 'warn' | 'error'} type
   * @param {any[]} args
   */
  const remoteLog = (type: 'log' | 'warn' | 'error', ...args: unknown[]) => {
    try {
      // 创建一个包含所有参数的结构化对象
      const payload = {
        type: type,
        // 我们直接将参数数组发送过去
        // JSON.stringify 会自动处理大多数JS类型
        payload: args,
      };

      // 将整个结构化对象转换为字符串，并用标记包裹
      // Metro 会将此作为单行日志打印出来
      originalLog(`${PREFIX}${JSON.stringify(payload)}${SUFFIX}`);

    } catch (e) {
      // 如果序列化失败（如循环引用），则回退到原始的 console.log
      originalLog('Logger Patch Error:', e);
      if (type === 'warn') {
        originalWarn.apply(console, args);
      } else if (type === 'error') {
        originalError.apply(console, args);
      } else {
        originalLog.apply(console, args);
      }
    }
  };

  // 覆盖全局 console 对象
  console.log = (...args) => remoteLog('log', ...args);
  console.warn = (...args) => remoteLog('warn', ...args);
  console.error = (...args) => remoteLog('error', ...args);
}
// --- END: CONSOLE LOG PATCH (v2) ---

console.log('starting app...')
listenLaunchEvent()


void Promise.all([getFontSize(), windowSizeTools.init()])
  .then(async ([fontSize]) => {
    global.lx.fontSize = fontSize
    bootLog('Font size setting loaded.')

    let isInited = false
    let handlePushedHomeScreen: () => void | Promise<void>

    const tryGetBootLog = () => {
      try {
        return getBootLog()
      } catch (err) {
        return 'Get boot log failed.'
      }
    }

    const handleInit = async () => {
      if (isInited) return
      void initLog()
      void initWebDAVLog()
      const { default: init } = await import('@/core/init')
      try {
        handlePushedHomeScreen = await init()
        if (settingState.setting['common.isShowStartupGreeting']) {
          toast(getTimeGreeting(), 'long')
        }
      } catch (err: any) {
        void tipDialog({
          title: '初始化失败 (Init Failed)',
          message: `Boot Log:\n${tryGetBootLog()}\n\n${(err.stack ?? err.message) as string}`,
          btnText: 'Exit',
          bgClose: false,
        }).then(() => {
          exitApp()
        })
        return
      }
      isInited ||= true
    }
    const { init: initNavigation, navigations } = await import('@/navigation')

    initNavigation(async () => {
      // 先推首页再执行初始化,避免启动时长时间停留在原生灰/白屏
      let homeReady = true
      const pushHomePromise = navigations
        .pushHomeScreen()
        .catch((err: any) => {
          homeReady = false
          void tipDialog({
            title: 'Error',
            message: err.message,
            btnText: 'Exit',
            bgClose: false,
          }).then(() => {
            exitApp()
          })
        })

      await handleInit()
      await pushHomePromise
      if (!isInited || !homeReady) return

      void handlePushedHomeScreen()
    })
  })
  .catch((err) => {
    void tipDialog({
      title: '初始化失败 (Init Failed)',
      message: `Boot Log:\n\n${(err.stack ?? err.message) as string}`,
      btnText: 'Exit',
      bgClose: false,
    }).then(() => {
      exitApp()
    })
  })
