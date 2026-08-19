/**
 * 统计页工具函数:日期、时长格式化、热力色阶
 */

export const DAY = 24 * 60 * 60 * 1000

export const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return '0分钟'
  const totalMinutes = Math.floor(seconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}分钟`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours}小时${minutes}分` : `${hours}小时`
}

export const formatDurationFull = (seconds: number): string => {
  if (seconds <= 0) return '0分钟'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h <= 0) return `${m}分钟`
  return `${h}小时${m}分`
}

export const formatNumber = (n: number): string => {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return `${n}`
}

export const getTodayText = () => toDateText(new Date())

export const toDateText = (date: Date) => {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const parseDateText = (text: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const [y, m, d] = text.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return date
}

export const toMonthText = (date: Date) => `${date.getFullYear()}年${date.getMonth() + 1}月`

export const changeMonth = (date: Date, offset: number) =>
  new Date(date.getFullYear(), date.getMonth() + offset, 1)

export interface MonthDay {
  date: Date
  dateText: string
  isCurrentMonth: boolean
}

/**
 * 生成一个月历网格(固定 42 格,周一起始)
 */
export const getMonthDays = (monthDate: Date): MonthDay[] => {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7))

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      date,
      dateText: toDateText(date),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
    }
  })
}

/**
 * 热力色阶:绿 → 黄 → 橙 → 红(HSL 插值)
 * @param duration 当天时长(秒)
 * @param maxDuration 满色基准(当月最大时长)
 */
export const getHeatColor = (duration: number, maxDuration: number): string => {
  if (duration <= 0) return 'rgba(128,128,128,0.12)'
  const ratio = Math.min(1, Math.sqrt(duration / Math.max(maxDuration, 1)))
  // hue: 145(绿) -> 0(红)
  const hue = Math.round(145 - 145 * ratio)
  const sat = 65 + Math.round(20 * ratio)
  const light = 45 - Math.round(15 * ratio)
  return `hsl(${hue}, ${sat}%, ${light}%)`
}

export const hasHeatData = (duration: number) => duration > 0
