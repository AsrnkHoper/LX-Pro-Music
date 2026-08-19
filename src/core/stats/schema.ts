/**
 * AI 报告 schema(v2 思路):事实层由本地补算,观点层可降级
 */
export interface AiReportV2 {
  schema_version: 2
  period: { start: string; end: string }
  overview: {
    total_plays: number
    total_duration_min: number
    active_days: number
    top_song?: { name?: string; singer?: string; plays?: number }
    top_artist?: { name?: string; plays?: number }
  }
  time?: {
    late_night_ratio?: number
    session_stats?: { session_count?: number; avg_min?: number; longest_min?: number }
    snooze_guess?: string
  }
  taste?: {
    repeat_obsession?: { name?: string; singer?: string; plays?: number }
    new_discoveries?: { name?: string; singer?: string }[]
  }
  identity?: {
    period_name?: string
    persona_tags?: string[]
    color?: { hex?: string; name?: string }
  }
  insights?: string[]
  stories?: { cover?: string; numbers?: string; time?: string; taste?: string }
  poster?: { headline?: string; ai_copy?: string; highlight?: string }
}

export const validateReportV2 = (data: unknown): string[] => {
  if (!data || typeof data !== 'object') return ['report 不是对象']
  const report = data as Partial<AiReportV2>
  const missing: string[] = []
  if (report.schema_version !== 2) missing.push(`schema_version=${String(report.schema_version)}`)
  if (!report.period?.start || !report.period?.end) missing.push('period')
  if (!report.overview || typeof report.overview !== 'object') {
    missing.push('overview')
  } else {
    if (typeof report.overview.total_plays !== 'number') missing.push('overview.total_plays')
    if (typeof report.overview.total_duration_min !== 'number') missing.push('overview.total_duration_min')
    if (typeof report.overview.active_days !== 'number') missing.push('overview.active_days')
  }
  return missing
}

export const parseReportV2 = (raw: string): unknown => {
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = fence[1].trim()
  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      const inner = JSON.parse(text)
      if (typeof inner === 'string') return JSON.parse(inner)
    } catch {
      // ignore
    }
  }
  return JSON.parse(text)
}
