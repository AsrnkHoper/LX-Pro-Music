/**
 * AI 报告生成:本地事实 + AI 观点 + 缓存/档案馆
 */
import { storageDataPrefix } from '@/config/constant'
import { getData, saveData } from '@/plugins/storage'
import { getStatsDailyByRange, getStatsEvents } from '@/core/player/stats'
import { AI_PROVIDER_CAPABILITY, buildAiSystemPrompt, chatCompletion, getAiConfig } from './ai'
import { parseReportV2, validateReportV2, type AiReportV2 } from './schema'

const reportKey = storageDataPrefix.statsReport
const archiveKey = storageDataPrefix.statsReportArchive

export interface PeriodFacts {
  overview: AiReportV2['overview']
  time: AiReportV2['time']
  taste: AiReportV2['taste']
}

export const getCurrentWeekRange = () => {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = (day + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - mondayOffset)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = `${d.getMonth() + 1}`.padStart(2, '0')
    const day = `${d.getDate()}`.padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return { start: fmt(monday), end: fmt(sunday) }
}

export const buildPeriodFacts = async (startTime: number, endTime: number): Promise<PeriodFacts> => {
  const daily = await getStatsDailyByRange(startTime, endTime)
  const events = await getStatsEvents()
  const rangeEvents = events.filter((e) => e.playedAt >= startTime && e.playedAt <= endTime)

  let totalPlays = 0
  let totalDuration = 0
  let activeDays = 0
  for (const d of daily) {
    totalPlays += d.plays
    totalDuration += d.duration
    if (d.active) activeDays += 1
  }

  const songAgg = new Map<string, { id: string; name: string; singer: string; plays: number }>()
  const artistAgg = new Map<string, { singer: string; plays: number }>()
  for (const e of rangeEvents) {
    const id = e.musicInfo?.id ?? ''
    if (!id) continue
    const song = songAgg.get(id)
    if (song) song.plays += 1
    else songAgg.set(id, { id, name: e.musicInfo.name, singer: e.musicInfo.singer, plays: 1 })

    const singer = e.musicInfo.singer || '未知歌手'
    const artist = artistAgg.get(singer)
    if (artist) artist.plays += 1
    else artistAgg.set(singer, { singer, plays: 1 })
  }
  const topSongs = Array.from(songAgg.values()).sort((a, b) => b.plays - a.plays)
  const topArtists = Array.from(artistAgg.values()).sort((a, b) => b.plays - a.plays)

  let lateNightSec = 0
  let totalSec = 0
  for (const e of rangeEvents) {
    totalSec += e.playTime
    const h = new Date(e.playedAt).getHours()
    if (h >= 23 || h < 5) lateNightSec += e.playTime
  }

  return {
    overview: {
      total_plays: totalPlays,
      total_duration_min: Math.round(totalDuration / 60),
      active_days: activeDays,
      top_song: topSongs[0]
        ? { name: topSongs[0].name, singer: topSongs[0].singer, plays: topSongs[0].plays }
        : undefined,
      top_artist: topArtists[0]
        ? { name: topArtists[0].singer, plays: topArtists[0].plays }
        : undefined,
    },
    time: {
      session_stats: {
        session_count: rangeEvents.length,
        avg_min: rangeEvents.length ? Math.round(totalSec / 60 / rangeEvents.length) : 0,
        longest_min: rangeEvents.length ? Math.round(Math.max(...rangeEvents.map((e) => e.playTime)) / 60) : 0,
      },
      late_night_ratio: totalSec > 0 ? Number((lateNightSec / totalSec).toFixed(2)) : 0,
    },
    taste: {
      repeat_obsession: topSongs[0]
        ? { name: topSongs[0].name, singer: topSongs[0].singer, plays: topSongs[0].plays }
        : undefined,
      new_discoveries: topSongs.slice(0, 3).map((s) => ({ name: s.name, singer: s.singer })),
    },
  }
}

export const buildAiPromptBody = (period: { start: string; end: string }, facts: PeriodFacts) => {
  const { overview, time, taste } = facts
  const lines = [
    `分析周期:${period.start} ~ ${period.end}`,
    `总播放:${overview.total_plays}次 | 总时长:${overview.total_duration_min}分钟 | 活跃:${overview.active_days}天`,
  ]
  if (overview.top_song?.name) lines.push(`最多播放:${overview.top_song.name} - ${overview.top_song.singer}(${overview.top_song.plays}次)`)
  if (overview.top_artist?.name) lines.push(`最多歌手:${overview.top_artist.name}(${overview.top_artist.plays}次)`)
  if (time?.session_stats) lines.push(`播放会话:${time.session_stats.session_count}次,均${time.session_stats.avg_min}分钟,最长${time.session_stats.longest_min}分钟`)
  if (typeof time?.late_night_ratio === 'number') lines.push(`深夜占比:${Math.round(time.late_night_ratio * 100)}%`)
  if (taste?.repeat_obsession?.name) lines.push(`循环之王:${taste.repeat_obsession.name} - ${taste.repeat_obsession.singer}(${taste.repeat_obsession.plays}次)`)
  return lines.join('\n')
}

const buildAiSystemForReport = () => {
  const angles = [
    '这次从「深夜与独处」的角度切入,突出深夜聆听的故事感',
    '这次从「循环与执念」的角度切入,讲反复听一首歌背后的情绪',
    '这次从「口味变化」的角度切入,讲这周在音乐上的探索与回归',
    '这次从「数据里的温度」角度切入,把次数/时长翻译成生活场景',
  ]
  const angle = angles[Math.floor(Math.random() * angles.length)]
  const schemaReq = [
    '按以下 JSON schema 返回(不要 Markdown 代码块,直接 JSON):',
    '{',
    '  "schema_version": 2,',
    '  "period": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"},',
    '  "overview": {"total_plays": 123, "total_duration_min": 456, "active_days": 7, "top_song": {"name": "歌名", "singer": "歌手", "plays": 10}, "top_artist": {"name": "歌手", "plays": 20}},',
    '  "time": {"session_stats": {"session_count": 10, "avg_min": 30, "longest_min": 120}, "late_night_ratio": 0.3, "snooze_guess": "作息推断"},',
    '  "taste": {"repeat_obsession": {"name": "歌名", "singer": "歌手", "plays": 5}, "new_discoveries": [{"name": "新歌", "singer": "新歌手"}]},',
    '  "identity": {"period_name": "周期名字", "persona_tags": ["标签1","标签2"]},',
    '  "insights": ["观点1"],',
    '  "stories": {"cover": "封面长文", "numbers": "数据长文", "time": "时间长文", "taste": "口味长文"},',
    '  "poster": {"headline": "海报标题", "ai_copy": "海报文案", "highlight": "亮点"}',
    '}',
    `写作角度:${angle}`,
    '数字必须是 number 类型;所有数字/歌名只能来自给定数据,一个都不能编。',
  ].join('\n')
  return `${buildAiSystemPrompt()}\n\n${schemaReq}`
}

const providerIdFromEndpoint = (endpoint: string): string => {
  const e = endpoint.toLowerCase()
  if (e.includes('deepseek')) return 'deepseek'
  if (e.includes('openrouter')) return 'openrouter'
  if (e.includes('ollama') || e.includes('11434')) return 'ollama'
  if (e.includes('dashscope') || e.includes('aliyuncs')) return 'tongyi'
  if (e.includes('moonshot') || e.includes('kimi')) return 'kimi'
  return 'none'
}

const finalizeReport = (raw: unknown, facts: PeriodFacts, period: { start: string; end: string }): AiReportV2 => {
  const report = (raw ?? {}) as Partial<AiReportV2>
  return {
    schema_version: 2,
    period,
    overview: { ...facts.overview, ...(report.overview ?? {}) },
    time: { ...facts.time, ...(report.time ?? {}) },
    taste: { ...facts.taste, ...(report.taste ?? {}) },
    identity: report.identity,
    insights: report.insights,
    stories: report.stories,
    poster: report.poster,
  }
}

export const readCachedReport = async (): Promise<AiReportV2 | null> => {
  const cached = await getData<{ fingerprint: string; report: AiReportV2 } | null>(reportKey)
  return cached?.report ?? null
}

export interface ArchiveItem {
  id: string
  period: { start: string; end: string }
  report: AiReportV2
  generatedAt: number
}

export const getReportArchive = async (): Promise<ArchiveItem[]> => {
  const list = await getData<ArchiveItem[] | null>(archiveKey)
  return list ?? []
}

export const deleteReportFromArchive = async (id: string) => {
  const list = await getReportArchive()
  await saveData(archiveKey, list.filter((item) => item.id !== id))
}

export const generateWeeklyReport = async (force = false): Promise<
  { ok: true; report: AiReportV2; cached: boolean } | { ok: false; error: string }
> => {
  try {
    const config = getAiConfig()
    if (!config.endpoint.trim() || !config.model.trim()) {
      return { ok: false, error: '请先在下方填写 Endpoint 和模型' }
    }
    const period = getCurrentWeekRange()
    const startTime = new Date(`${period.start}T00:00:00`).getTime()
    const endTime = new Date(`${period.end}T23:59:59`).getTime()
    const facts = await buildPeriodFacts(startTime, endTime)

    const fingerprint = `${period.start}|${facts.overview.total_plays}|${facts.overview.total_duration_min}|${facts.overview.active_days}`
    if (!force) {
      const cached = await getData<{ fingerprint: string; report: AiReportV2 } | null>(reportKey)
      if (cached?.fingerprint === fingerprint) return { ok: true, report: cached.report, cached: true }
    }

    const system = buildAiSystemForReport()
    const user = buildAiPromptBody(period, facts)
    const capability = AI_PROVIDER_CAPABILITY[providerIdFromEndpoint(config.endpoint)] ?? 'none'

    // DeepSeek Harness Web 等推理模型偶发缺字段/空内容,给足重试次数
    const MAX_ATTEMPTS = 10
    let lastError = ''
    let lastMissing: string[] = []

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const extraHint = lastMissing.length
          ? `\n上次返回缺少字段:${lastMissing.join(', ')},请补全后重新输出完整 JSON。`
          : lastError
            ? `\n上次返回解析失败:${lastError},请只输出合法 JSON,不要 Markdown 代码块。`
            : ''
        const raw = await chatCompletion({
          endpoint: config.endpoint,
          apiKey: config.apiKey,
          model: config.model,
          system: extraHint ? `${system}\n${extraHint}` : system,
          user,
          capability,
          maxTokens: 8192,
          timeoutMs: 240000,
        })
        const parsed = parseReportV2(raw)
        const missing = validateReportV2(parsed)
        if (missing.length === 0) {
          const report = finalizeReport(parsed, facts, period)
          const hasAiFields = report.identity?.period_name || report.insights?.length || report.poster?.ai_copy || report.stories?.cover
          if (hasAiFields) {
            await saveData(reportKey, { fingerprint, report })
            const archive = await getReportArchive()
            archive.unshift({ id: String(Date.now()), period, report, generatedAt: Date.now() })
            await saveData(archiveKey, archive.slice(0, 30))
            return { ok: true, report, cached: false }
          }
          lastError = 'AI 返回缺少文案字段'
        } else {
          lastMissing = missing
          lastError = `字段缺失:${missing.join(', ')}`
        }
      } catch (err: any) {
        lastError = err?.message ?? String(err)
        lastMissing = []
      }
    }

    return { ok: false, error: `AI 生成失败(已尝试 ${MAX_ATTEMPTS} 次):${lastError || '未知原因'}` }

  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }
}
