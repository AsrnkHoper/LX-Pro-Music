/**
 * AI 报告生成(功能块②)—— 数据组装 + 请求 + 四层补救 + 缓存
 *
 * 依据:策划设计.md 第十二节功能块②
 * - 本地管事实:周期数据从 @stats_daily/@stats_song/@stats_events 提取,事实层本地算
 * - AI 管观点:overview/time/taste 事实层已本地算好,AI 只补观点层(identity/compare 解读/stories/poster/insights)
 * - 请求体 <2KB:月度只发聚合数据,不发原始事件
 * - 四层补救:① 能力白名单三层降级 ② 校验+重试 ③ 本地补算 ④ 降级展示
 * - 缓存 @stats_report:周期指纹未变不重生成
 */
import {
  getStatsDailyByRange,
  getStatsTopSongs,
  getStatsTopArtists,
  getStatsEvents,
} from '@/core/player/stats'
import { storageDataPrefix } from '@/config/constant'
import { getData, saveData } from '@/plugins/storage'
import { buildAiSystemPrompt, getAiConfig, AI_PROVIDER_CAPABILITY } from '@/core/stats/ai'
import {
  parseReportV2,
  validateReportV2,
  type AiReportV2,
  type Overview,
  type Time,
  type Taste,
} from '@/core/stats/schema'

const reportKey = storageDataPrefix.statsReport

/** 周期数据(事实层,本地算) */
export interface PeriodFacts {
  overview: Overview
  time: Time
  taste: Taste
}

/** 请求结果:成功返回报告;失败返回原因 */
export type GenerateReportResult =
  | { ok: true; report: AiReportV2; cached: boolean }
  | { ok: false; error: string }

/** 分析周期(默认本周:周一 00:00 ~ 周日 23:59) */
export const getCurrentWeekRange = (): { start: string; end: string } => {
  const now = new Date()
  const day = now.getDay() // 0=周日
  const mondayOffset = (day + 6) % 7 // 周一=0
  const monday = new Date(now)
  monday.setDate(now.getDate() - mondayOffset)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  return { start: fmt(monday), end: fmt(sunday) }
}

/** 组装周期事实层(本地计算,不发原始事件,请求体 <2KB) */
export const buildPeriodFacts = async (startTime: number, endTime: number): Promise<PeriodFacts> => {
  const daily = await getStatsDailyByRange(startTime, endTime)
  const topSongs = (await getStatsTopSongs(5)).slice(0, 5)
  const topArtists = (await getStatsTopArtists(5)).slice(0, 5)

  // overview
  let totalPlays = 0
  let totalDuration = 0
  let activeDays = 0
  for (const d of daily) {
    totalPlays += d.plays
    totalDuration += d.duration
    if (d.active) activeDays += 1
  }
  const overview: Overview = {
    total_plays: totalPlays,
    total_duration_min: Math.round(totalDuration / 60),
    active_days: activeDays,
    top_song: topSongs[0]
      ? { name: topSongs[0].name, singer: topSongs[0].singer, plays: topSongs[0].plays }
      : undefined,
    top_artist: topArtists[0]
      ? { name: topArtists[0].singer, plays: topArtists[0].plays }
      : undefined,
  }

  // time:从原始事件算时段分布(23:00-05:00 深夜占比)
  const events = await getStatsEvents()
  const inRangeEvents = events.filter((e) => e.playedAt >= startTime && e.playedAt <= endTime)
  let lateNightSec = 0
  let totalSec = 0
  for (const e of inRangeEvents) {
    totalSec += e.playTime
    const h = new Date(e.playedAt).getHours()
    if (h >= 23 || h < 5) lateNightSec += e.playTime
  }
  const time: Time = {
    hourly_heat: undefined, // 由 App 端渲染时算(此处不发,控制请求体)
    weekday_pattern: undefined,
    session_stats: {
      session_count: inRangeEvents.length,
      avg_min: inRangeEvents.length ? Math.round(totalSec / 60 / inRangeEvents.length) : 0,
      longest_min: inRangeEvents.length ? Math.round(Math.max(...inRangeEvents.map((e) => e.playTime)) / 60) : 0,
    },
    late_night_ratio: totalSec > 0 ? Number((lateNightSec / totalSec).toFixed(2)) : 0,
  }

  // taste:top 歌/歌手 + 循环之王
  const taste: Taste = {
    genre_shift: { top_genres: topArtists.map((a) => a.singer).slice(0, 3) },
    repeat_obsession: topSongs[0]
      ? { name: topSongs[0].name, singer: topSongs[0].singer, plays: topSongs[0].plays }
      : undefined,
    new_discoveries: topSongs.slice(0, 3).map((s) => ({
      name: s.name,
      singer: s.singer,
      first_heard: s.firstPlayedAt ? new Date(s.firstPlayedAt).toISOString().slice(0, 10) : undefined,
    })),
  }

  return { overview, time, taste }
}

/** 构造发给 AI 的请求体(事实层数据 + schema 要求,<2KB) */
export const buildAiPromptBody = (
  period: { start: string; end: string },
  facts: PeriodFacts
): string => {
  const { overview, time, taste } = facts
  const lines: string[] = []
  lines.push(`分析周期:${period.start} ~ ${period.end}`)
  lines.push(`总播放:${overview.total_plays}次 | 总时长:${overview.total_duration_min}分钟 | 活跃:${overview.active_days}天`)
  if (overview.top_song) lines.push(`最多播放:${overview.top_song.name} - ${overview.top_song.singer}(${overview.top_song.plays}次)`)
  if (overview.top_artist) lines.push(`最多歌手:${overview.top_artist.name}(${overview.top_artist.plays}次)`)
  if (time.session_stats) lines.push(`播放会话:${time.session_stats.session_count}次,均${time.session_stats.avg_min}分钟,最长${time.session_stats.longest_min}分钟`)
  if (typeof time.late_night_ratio === 'number') lines.push(`深夜占比:${Math.round(time.late_night_ratio * 100)}%`)
  if (taste.repeat_obsession) lines.push(`循环之王:${taste.repeat_obsession.name} - ${taste.repeat_obsession.singer}(${taste.repeat_obsession.plays}次)`)
  if (taste.genre_shift?.top_genres?.length) lines.push(`常听歌手:${taste.genre_shift.top_genres.join('/')}`)
  return lines.join('\n')
}

/** 组装给 AI 的完整 system prompt(含 schema 要求) */
export const buildAiSystemForReport = (): string => {
  const config = getAiConfig()
  const base = buildAiSystemPrompt(config)
  const schemaReq = [
    '按以下 JSON schema 返回(不要 Markdown 代码块,直接 JSON):',
    '{',
    '  "schema_version": 2,',
    '  "period": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"},',
    '  "identity": {"period_name": "周期名字", "persona_tags": ["标签1","标签2"], "color_note": "一句话"},',
    '  "compare": {"genre_shift_summary": "口味迁移一句话", "revisit_note": "长期记忆回链"},',
    '  "insights": [{"text": "观点", "data_basis": "数据依据"}],',
    '  "stories": {"cover": "封面卡长文(<150字)", "numbers": "数据卡长文", "time": "时间卡长文", "taste": "口味卡长文"},',
    '  "poster": {"headline": "海报标题", "ai_copy": "海报文案", "highlight": "亮点"}',
    '}',
    '字段说明:identity.period_name 给周期起名;persona_tags 2-3个标签;compare.genre_shift_summary 口味迁移;',
    'stories 每段<150字且必须基于给定数据;insights 附 data_basis 数据依据;所有数字/歌名只能来自给定数据,一个都不能编。',
  ].join('\n')
  return `${base}\n\n${schemaReq}`
}

/** 报告缓存:周期指纹 = 起止 + 事实层摘要,未变则命中 */
export const getCachedReport = async (
  period: { start: string; end: string },
  facts: PeriodFacts
): Promise<AiReportV2 | null> => {
  const cached = await getData<{ fingerprint: string; report: AiReportV2 } | null>(reportKey)
  if (!cached) return null
  const fp = fingerprint(period, facts)
  return cached.fingerprint === fp ? cached.report : null
}

/** 直接读缓存报告(展示入口用,不校验指纹,纯读取) */
export const readCachedReport = async (): Promise<AiReportV2 | null> => {
  const cached = await getData<{ fingerprint: string; report: AiReportV2 } | null>(reportKey)
  return cached?.report ?? null
}

/** 保存报告缓存 */
export const saveReportCache = async (
  period: { start: string; end: string },
  facts: PeriodFacts,
  report: AiReportV2
): Promise<void> => {
  await saveData(reportKey, { fingerprint: fingerprint(period, facts), report })
}

/** 周期指纹:起止 + 关键事实(防重复烧 token) */
const fingerprint = (period: { start: string; end: string }, facts: PeriodFacts): string => {
  return `${period.start}-${period.end}|${facts.overview.total_plays}|${facts.overview.total_duration_min}|${facts.overview.active_days}`
}

/** 四层补救后的最终报告(本地补算字段填回) */
export const finalizeReport = (raw: unknown, facts: PeriodFacts, period: { start: string; end: string }): AiReportV2 => {
  const report = (raw ?? {}) as Partial<AiReportV2>
  // 第三层:本地补算(事实层 AI 漏了/错了用本地数据覆盖)
  const result: AiReportV2 = {
    schema_version: 2,
    period: { start: period.start, end: period.end },
    overview: { ...facts.overview, ...(report.overview ?? {}) },
    time: { ...facts.time, ...(report.time ?? {}) },
    taste: { ...facts.taste, ...(report.taste ?? {}) },
    mood: report.mood,
    pro: report.pro,
    identity: report.identity,
    compare: report.compare,
    insights: report.insights,
    stories: report.stories,
    poster: report.poster,
  }
  return result
}

/** 生成本周报告(完整闭环:组装 → 请求 → 校验重试 → 本地补算 → 缓存) */
export const generateWeeklyReport = async (): Promise<GenerateReportResult> => {
  try {
    const config = getAiConfig()
    if (!config.endpoint.trim() || !config.model.trim()) {
      return { ok: false, error: '请先在 AI 设置里填写 Endpoint 和模型' }
    }
    const period = getCurrentWeekRange()
    const startTime = new Date(`${period.start}T00:00:00`).getTime()
    const endTime = new Date(`${period.end}T23:59:59`).getTime()
    const facts = await buildPeriodFacts(startTime, endTime)

    // 缓存命中
    const cached = await getCachedReport(period, facts)
    if (cached) return { ok: true, report: cached, cached: true }

    // 组装请求
    const system = buildAiSystemForReport()
    const userData = buildAiPromptBody(period, facts)

    // 能力白名单 → 三层降级请求
    const capability = AI_PROVIDER_CAPABILITY[providerIdFromEndpoint(config.endpoint)] ?? 'none'
    const { chatCompletion } = await import('@/core/stats/ai')
    const raw = await chatCompletion({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      model: config.model,
      system,
      user: userData,
      capability,
      maxTokens: 2048,
    })

    // 第二层:校验 + 重试(最多 2 次)
    let report: AiReportV2 | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const parsed = parseReportV2(raw)
        const missing = validateReportV2(parsed)
        if (missing.length === 0) {
          report = finalizeReport(parsed, facts, period)
          break
        }
        if (attempt === 0) {
          const retry = await chatCompletion({
            endpoint: config.endpoint,
            apiKey: config.apiKey,
            model: config.model,
            system: `${system}\n注意:上次返回缺少 ${missing.join(', ')},请补全后重新输出完整 JSON。`,
            user: userData,
            capability,
            maxTokens: 2048,
          })
          const parsed2 = parseReportV2(retry)
          if (validateReportV2(parsed2).length === 0) {
            report = finalizeReport(parsed2, facts, period)
            break
          }
        }
      } catch {
        // 解析失败,重试
      }
    }

    if (!report) {
      // 即使校验失败,也用本地事实生成兜底报告(降级展示)
      report = finalizeReport(null, facts, period)
    }

    await saveReportCache(period, facts, report)
    return { ok: true, report, cached: false }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
}

/** 从 endpoint 推断服务商 id(能力白名单用) */
const providerIdFromEndpoint = (endpoint: string): string => {
  const e = endpoint.toLowerCase()
  if (e.includes('deepseek')) return 'deepseek'
  if (e.includes('openrouter')) return 'openrouter'
  if (e.includes('ollama') || e.includes('11434')) return 'ollama'
  if (e.includes('dashscope') || e.includes('aliyuncs') || e.includes('tongyi')) return 'tongyi'
  if (e.includes('moonshot') || e.includes('kimi')) return 'kimi'
  return 'none'
}
