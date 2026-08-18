/**
 * 听歌统计页工具:连续色阶 / 日期工具 / 时长格式化
 *
 * 色阶方案(琥珀定制):绿 → 黄 → 橙 → 红 连续渐变,无档位台阶。
 *  - 色相从 120°(绿)平滑滑到 0°(红),随听歌时长线性映射
 *  - 同时亮度递减、不透明度递增:时长越久,颜色越深越实
 *  - 满色阶 = 24 小时(听满一天达到最深红)
 *  - 时长 0 = 无数据,显示透明(与"听过一点"的极淡绿区分)
 */

/** 满色阶时长(秒) = 24 小时 */
export const MAX_HEAT_SECONDS = 24 * 60 * 60

/** HSL → rgba 字符串(react-native 支持 hsla,直接返回 hsla 更简单) */
const hslToHsla = (h: number, s: number, l: number, a: number): string =>
  `hsla(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${a})`

/**
 * 按实际秒数生成热力图颜色(连续渐变,无档位,动态色阶)
 *  - maxDuration = 当月听歌时长最大值(满色基准),传入当月最高的那天的时长
 *  - duration 相对 maxDuration 线性映射,当月最多的一天 = 最深红
 *  - 这样无论用户日均听 30 分钟还是 3 小时,热力图都有完整层次
 *  - duration <= 0 → 透明(无数据)
 *  - 色相 120°(绿) → 0°(红),亮度递减,透明度递减
 */
export const getHeatColor = (duration: number, maxDuration: number): string => {
  if (duration <= 0) return 'transparent'
  if (maxDuration <= 0) return 'transparent'
  const ratio = Math.min(1, duration / maxDuration)
  const hue = 120 - ratio * 120            // 120° 绿 → 60° 黄 → 30° 橙 → 0° 红
  const saturation = 0.6 + ratio * 0.35    // 越久越饱和
  const lightness = 0.6 - ratio * 0.28     // 越久越暗(0.6 → 0.32)
  const alpha = 0.3 + ratio * 0.7          // 越久越不透明(0.3 → 1)
  return hslToHsla(hue, saturation, lightness, alpha)
}

/** 判断该时长是否有数据(用于决定格子文字颜色) */
export const hasHeatData = (duration: number): boolean => duration > 0

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
