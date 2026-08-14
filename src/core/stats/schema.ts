/**
 * AI 报告 schema v2 类型定义 + 校验(功能块②)
 *
 * 依据:策划设计.md 5.2(schema 结构)/ 第十二节功能块②
 * - schema_version = 2:五层(overview/time/taste/mood/pro)+ identity + compare + insights + stories + poster
 * - 本地补算字段(事实层):AI 漏了用本地数据填回
 * - AI 原创字段(观点层):缺失走降级展示
 * - 校验规则:JSON.parse + 必填白名单;`schema_version` 不匹配走降级
 */

/** 周期身份层(AI 原创为主,可降级) */
export interface Identity {
  /** 给这个周期起的名字(Spotify "Music Evolution" 式) */
  period_name?: string
  /** 周期人格标签(2~3 个) */
  persona_tags?: string[]
  /** 音乐颜色(封面优先+流派兜底,此处为最终 hex) */
  color?: { hex?: string; name?: string }
  /** AI 一句话解释颜色 */
  color_note?: string
}

/** 跨周期对比层(本地补算为主 + AI 解读) */
export interface Compare {
  /** 与上一周期次数变化百分比(本地算,下降为负) */
  plays_delta_pct?: number
  /** 与上一周期时长变化百分比(本地算) */
  duration_delta_pct?: number
  /** 新认识的歌手数(本地算) */
  new_artists_count?: number
  /** 新歌数(本地算) */
  new_discoveries_count?: number
  /** 口味迁移一句话(AI 写,可降级) */
  genre_shift_summary?: string
  /** 长期记忆回链(AI 写,可降级) */
  revisit_note?: string
}

/** overview 层(全本地补算,必填) */
export interface Overview {
  total_plays: number
  total_duration_min: number
  active_days: number
  top_song?: { name?: string; singer?: string; plays?: number }
  top_artist?: { name?: string; plays?: number }
}

/** time 层(本地补算为主,AI 解读可降级) */
export interface Time {
  hourly_heat?: number[]
  weekday_pattern?: number[]
  session_stats?: { avg_min?: number; longest_min?: number; session_count?: number }
  late_night_ratio?: number
  /** AI 原创:作息推断文案(可降级) */
  snooze_guess?: string
  /** 观点锚点:AI 原创字段附数据依据(可选) */
  data_basis?: string
}

/** taste 层(本地补算为主) */
export interface Taste {
  genre_shift?: { top_genres?: string[]; shift_note?: string }
  new_discoveries?: { name?: string; singer?: string; first_heard?: string }[]
  repeat_obsession?: { name?: string; singer?: string; plays?: number; days?: number }
  abandoned_songs?: { name?: string; singer?: string; avg_played_sec?: number }[]
  era_taste?: { top_era?: string; ratio?: number }
}

/** mood 层(AI 原创,整体可降级显示"暂无解读") */
export interface Mood {
  [key: string]: unknown
}

/** pro 层(混合:本地算 avg/分布,AI 写趋势) */
export interface Pro {
  bpm_stats?: { avg_bpm?: number; trend?: string }
  key_distribution?: { top_key?: string; minor_ratio?: number }
  energy_level?: { avg?: number; trend?: string }
  listening_focus?: { focus_ratio?: number; note?: string }
}

/** 观点锚点:每项及 AI 原创字段附数据依据 */
export interface Insight {
  text?: string
  data_basis?: string
}

/** 故事流每卡长文(与卡片一一对应,可降级=该卡长文按钮置灰) */
export interface Stories {
  cover?: string
  numbers?: string
  time?: string
  taste?: string
  genre_shift?: string
  annual_top?: string
  keywords?: string
  poster?: string
  [key: string]: string | undefined
}

/** 海报(AI 原创文案,可降级) */
export interface Poster {
  level?: 'month' | 'quarter' | 'year'
  headline?: string
  ai_copy?: string
  highlight?: string
  keywords?: string[]
}

/** schema v2 完整报告结构 */
export interface AiReportV2 {
  schema_version: 2
  /** 分析周期(YYYY-MM-DD) */
  period: { start: string; end: string }
  overview: Overview
  time: Time
  taste: Taste
  mood?: Mood
  pro?: Pro
  identity?: Identity
  compare?: Compare
  insights?: Insight[]
  stories?: Stories
  poster?: Poster
}

/** 校验必填白名单(本地补算字段 = 事实层,必须存在;AI 原创字段缺失走降级不阻断) */
export const REQUIRED_LOCAL_FIELDS: (keyof AiReportV2)[] = [
  'schema_version',
  'period',
  'overview',
]

/** 校验 schema v2 报告:返回缺失的必填字段列表(空 = 通过) */
export const validateReportV2 = (data: unknown): string[] => {
  if (!data || typeof data !== 'object') return ['report 不是对象']
  const report = data as Partial<AiReportV2>
  const missing: string[] = []
  if (report.schema_version !== 2) missing.push(`schema_version=${String(report.schema_version)}`)
  if (!report.period || !report.period.start || !report.period.end) missing.push('period')
  if (!report.overview || typeof report.overview !== 'object') {
    missing.push('overview')
  } else {
    const o = report.overview as Partial<Overview>
    if (typeof o.total_plays !== 'number') missing.push('overview.total_plays')
    if (typeof o.total_duration_min !== 'number') missing.push('overview.total_duration_min')
    if (typeof o.active_days !== 'number') missing.push('overview.active_days')
  }
  return missing
}

/**
 * 从模型原始 JSON 解析出报告,容错:
 * - 可能带 ```json 代码块包裹(模型常犯)
 * - 可能整个是字符串(模型把 JSON 当字符串返回)
 */
export const parseReportV2 = (raw: string): unknown => {
  let text = raw.trim()
  // 去 ```json ... ``` 代码块
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = fence[1].trim()
  // 若被包成字符串 "..." 再解析一次
  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      const inner = JSON.parse(text)
      if (typeof inner === 'string') return JSON.parse(inner)
    } catch {
      // 忽略,走下面的正常解析
    }
  }
  return JSON.parse(text)
}
