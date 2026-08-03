/**
 * 听歌统计页工具:色阶算法 / 日期工具 / 时长格式化
 * 色阶规格(策划文档 7.1):0=无数据,固定 12h 为满色阶,按 1/5 分段(2.4h/4.8h/7.2h/9.6h/12h+)
 * 颜色:基于主题主色 HSL 调亮度 + 透明度层级,深/浅主题都适配
 */

/** 满色阶时长(秒) = 12 小时 */
export const MAX_HEAT_SECONDS = 12 * 60 * 60
/** 色阶分段数(5 级) */
export const HEAT_LEVELS = 5

/** 按实际秒数计算色阶等级(0 = 无数据,1~5) */
export const getHeatLevel = (duration: number): number => {
  if (duration <= 0) return 0
  const ratio = duration / MAX_HEAT_SECONDS
  if (ratio >= 1) return HEAT_LEVELS
  return Math.min(HEAT_LEVELS, Math.max(1, Math.ceil(ratio * HEAT_LEVELS)))
}

/** 每级色阶的透明度(由浅到深),level 0 为透明 */
const LEVEL_ALPHAS = [0, 0.14, 0.3, 0.5, 0.7, 0.9]

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3 ? normalized.split('').map(c => c + c).join('') : normalized
  const num = parseInt(full, 16)
  if (Number.isNaN(num)) return { r: 0, g: 0, b: 0 }
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

/** 根据主题主色生成某色阶等级的颜色字符串(带透明度) */
export const getHeatColor = (level: number, primaryColor: string): string => {
  if (level <= 0) return 'transparent'
  const { r, g, b } = hexToRgb(primaryColor)
  const alpha = LEVEL_ALPHAS[Math.min(HEAT_LEVELS, level)]
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** 秒数 → "X小时X分"(不足 1 分钟显示 "X分",不足 1 小时显示 "X分",0 显示 "0分") */
export const formatDuration = (seconds: number): string => {
  const totalMin = Math.floor(seconds / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}小时${m}分`
  return `${m}分`
}

/** 秒数 → "X小时X分X秒"(当天账本详情用) */
export const formatDurationFull = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}小时${m}分${s}秒`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

/** 秒数 → "H:MM" 或 "M:SS" 紧凑格式 */
export const formatDurationCompact = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${`${s}`.padStart(2, '0')}`
}

export const toDateText = (date: Date): string => {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const toMonthText = (date: Date): string => {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${y}-${m}`
}

export const parseDateText = (text: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const [y, m, d] = text.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return date
}

/** 获取某月的天数组(含邻月补齐,周一开头,42 格) */
export type MonthDay = { date: Date; dateText: string; isCurrentMonth: boolean }
export const getMonthDays = (monthDate: Date): MonthDay[] => {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  // 周一开头:getDay() 0=周日 → 偏移使周一为 0
  const offset = (firstDay.getDay() + 6) % 7
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - offset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    return {
      date,
      dateText: toDateText(date),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
    }
  })
}

export const changeMonth = (date: Date, offset: number): Date => new Date(date.getFullYear(), date.getMonth() + offset, 1)

/** 周几文案(周一开头) */
export const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

/** 判断两个日期文本是否为同一天 */
export const isSameDayText = (a: string, b: string): boolean => a === b

/** 获取"今天"的日期文本 */
export const getTodayText = (): string => toDateText(new Date())
