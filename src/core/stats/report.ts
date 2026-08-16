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
  // 周期内原始事件(口径统一:top_song/top_artist/循环之王/新发现 全部按本周期算,不混全年累计)
  const events = await getStatsEvents()
  const inRangeEvents = events.filter((e) => e.playedAt >= startTime && e.playedAt <= endTime)

  // 周期内歌曲聚合
  const songAgg = new Map<string, { id: string; name: string; singer: string; plays: number; firstPlayedAt: number }>()
  for (const e of inRangeEvents) {
    const id = e.musicInfo?.id ?? ''
    if (!id) continue
    const cur = songAgg.get(id)
    if (cur) {
      cur.plays += 1
      if (e.playedAt < cur.firstPlayedAt) cur.firstPlayedAt = e.playedAt
    } else {
      songAgg.set(id, {
        id,
        name: e.musicInfo?.name ?? '',
        singer: e.musicInfo?.singer ?? '',
        plays: 1,
        firstPlayedAt: e.playedAt,
      })
    }
  }
  const topSongs = Array.from(songAgg.values()).sort((a, b) => b.plays - a.plays).slice(0, 5)

  // 周期内歌手聚合
  const artistAgg = new Map<string, { singer: string; plays: number }>()
  for (const e of inRangeEvents) {
    const singer = e.musicInfo?.singer ?? ''
    if (!singer) continue
    const cur = artistAgg.get(singer)
    if (cur) cur.plays += 1
    else artistAgg.set(singer, { singer, plays: 1 })
  }
  const topArtists = Array.from(artistAgg.values()).sort((a, b) => b.plays - a.plays).slice(0, 5)

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

  // taste:top 歌/歌手 + 循环之王 + 新发现(周期内首次听到的)
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
  if (time.session_stats) lines.push(`播放${time.session_stats.session_count}次,平均每次只听了${time.session_stats.avg_min}分钟(可能是没听完就切),最长一次连续听了${time.session_stats.longest_min}分钟`) 
  if (typeof time.late_night_ratio === 'number') lines.push(`深夜占比:${Math.round(time.late_night_ratio * 100)}%`)
  if (taste.repeat_obsession) lines.push(`循环之王:${taste.repeat_obsession.name} - ${taste.repeat_obsession.singer}(${taste.repeat_obsession.plays}次)`)
  if (taste.genre_shift?.top_genres?.length) lines.push(`常听歌手:${taste.genre_shift.top_genres.join('/')}`)
  return lines.join('\n')
}

/** 组装给 AI 的完整 system prompt(含 schema 要求 + 随机切入角度) */
export const buildAiSystemForReport = (): string => {
  const config = getAiConfig()
  const base = buildAiSystemPrompt(config)
  const schemaReq = [
    '你是听歌报告作家。用户有固定的"封面卡"和"海报卡"(由 App 渲染,你只负责填写字段),你的核心任务:',
    '1. 从下面的卡型菜单里,挑出本周期最有故事性的 3-6 张卡,写进 cards 数组',
    '2. 每张卡:card_key(菜单里的 key)、title(AI 自由起名,要有惊喜感,像懂 TA 的朋友说的话)、body(2-3 句,基于数据)、data_basis(数据依据,证明不是编的)',
    '3. 如果数据里有特别意外的点(某首歌深夜突然回归/某天爆听/被低估的歌手等),可写 1 张 card_key="surprise" 的自由惊喜卡(同样要有 data_basis);没有惊喜点就不写',
    '4. 不要写满所有卡型,只挑真正有故事性的',
    '',
    '重要语义(避免误解数据):',
    '- "平均每次播放X分钟"是播放行为(可能没听完就切),不是歌曲本身长度;',
    '- "最长一次连续播放X分钟"是单次连续聆听时长,不是某首歌的长度;',
    '- 写 fragments/专注时刻 等卡型时,不要说"这首歌X分钟",要说"你听了X分钟就切/连续听了X分钟";',
    '',
    '卡型菜单(挑 3-6 张):',
    '- deep_night 深夜高墙:深夜播放占比高',
    '- loop_king 循环之王:某首歌反复播放',
    '- taste_shift 口味变迁:口味变化',
    '- hidden_gem 冷门宝藏:播放少但时长长的歌',
    '- nostalgia 怀旧回响:很久没听的歌突然回归',
    '- new_frontier 新大陆:新歌手/新歌占比高',
    '- emotion_ride 情绪过山车:单日播放波动大',
    '- early_bird 早鸟:清晨 5-8 点播放多',
    '- upset 爆冷逆袭:某首歌从低到高',
    '- underrated 被低估的歌手:歌手播放高但不在 top',
    '- disconnect 断联回归:上一周期 top 歌本周期消失',
    '- brainworm 单曲洗脑:同首歌连续多天',
    '- focus_moment 专注时刻:单次连续播放长',
    '- empty_day 空窗日:某天 0 播放',
    '- fragments 碎片时间:平均播放时长极短',
    '- night_whisper 深夜私语:深夜听小众歌',
    '- outside_playlist 歌单之外:自己找到的歌',
    '- new_king 年度新王:新歌迅速登顶',
    '',
    '按这个 JSON 返回(不要 Markdown 代码块,直接 JSON):',
    '{',
    '  "schema_version": 2,',
    '  "period": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"},',
    '  "identity": {"period_name": "给这个周期起个有诗意的名字", "persona_tags": ["标签1","标签2"], "color_note": "一句话"},',
    '  "cards": [{"card_key": "deep_night", "title": "AI 自由起标题", "body": "2-3句话", "data_basis": "数据依据"}],',
    '  "poster": {"headline": "海报标题", "ai_copy": "海报文案", "highlight": "亮点"}',
    '}',
    'identity.period_name 给周期起名;poster 给海报写文案;cards 至少 1 张;所有数字/歌名只能来自给定数据,一个都不能编。',
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

/** 报告档案馆条目 */
export interface ArchiveItem {
  /** 唯一 ID(生成时间戳) */
  id: string
  /** 周期(YYYY-MM-DD 起止) */
  period: { start: string; end: string }
  report: AiReportV2
  /** 生成时间戳 */
  generatedAt: number
}
const archiveKey = storageDataPrefix.statsReportArchive

/** 读全部历史报告(按生成时间倒序) */
export const getReportArchive = async (): Promise<ArchiveItem[]> => {
  const list = await getData<ArchiveItem[] | null>(archiveKey)
  if (!Array.isArray(list)) return []
  return [...list].sort((a, b) => b.generatedAt - a.generatedAt)
}

/** 删除档案馆中的一份报告 */
export const deleteReportFromArchive = async (id: string): Promise<void> => {
  const list = await getReportArchive()
  await saveData(archiveKey, list.filter((it) => it.id !== id))
}

/** 导入报告到档案馆:与现有报告按 id 去重合并,保留最多 30 份 */
export const importReportArchive = async (items: ArchiveItem[]): Promise<void> => {
  if (!Array.isArray(items)) throw new Error('报告档案格式不正确')
  for (const it of items) {
    if (!it || typeof it !== 'object' || !it.id || !it.period || !it.report || typeof it.generatedAt !== 'number') {
      throw new Error('报告档案格式不正确')
    }
  }
  const list = await getReportArchive()
  const map = new Map<string, ArchiveItem>()
  for (const it of list) map.set(it.id, it)
  for (const it of items) map.set(it.id, it)
  const merged = Array.from(map.values())
    .sort((a, b) => b.generatedAt - a.generatedAt)
    .slice(0, 30)
  await saveData(archiveKey, merged)
}

/** 追加一份报告到档案馆(每次生成都保留,不覆盖,最多留 30 份) */
export const addReportToArchive = async (report: AiReportV2): Promise<void> => {
  const list = await getReportArchive()
  const now = Date.now()
  const item: ArchiveItem = { id: String(now), period: report.period, report, generatedAt: now }
  const filtered = list.filter((it) => it.id !== item.id)
  filtered.unshift(item)
  await saveData(archiveKey, filtered.slice(0, 30))
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
    cards: report.cards,
  }
  return result
}

/** 生成本周报告(完整闭环:组装 → 请求 → 校验重试 → 本地补算 → 缓存)
 * @param force true=强制重新请求 AI(跳过缓存,试生成用);false=缓存命中直接返回 */
export const generateWeeklyReport = async (force = false): Promise<GenerateReportResult> => {
  try {
    const config = getAiConfig()
    if (!config.endpoint.trim() || !config.model.trim()) {
      return { ok: false, error: '请先在 AI 设置里填写 Endpoint 和模型' }
    }
    const period = getCurrentWeekRange()
    const startTime = new Date(`${period.start}T00:00:00`).getTime()
    const endTime = new Date(`${period.end}T23:59:59`).getTime()
    const facts = await buildPeriodFacts(startTime, endTime)

    // 缓存命中(force=true 时跳过,试生成永远真请求 AI)
    if (!force) {
      const cached = await getCachedReport(period, facts)
      if (cached) return { ok: true, report: cached, cached: true }
    }

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
      maxTokens: 8192,
      timeoutMs: 240000,
    })

    // 第二层:校验 + 重试(最多 1 次重试,每次都重新校验返回值)
    let report: AiReportV2 | null = null
    let lastError = ''
    const tryParse = (respText: string): { report?: AiReportV2; missing: string[] } => {
      try {
        const parsed = parseReportV2(respText)
        const missing = validateReportV2(parsed)
        if (missing.length === 0) return { report: finalizeReport(parsed, facts, period), missing: [] }
        return { missing }
      } catch (err: any) {
        lastError = err?.message ?? String(err)
        return { missing: [] }
      }
    }
    // 第一次解析
    const first = tryParse(raw)
    if (first.report) {
      report = first.report
    } else if (first.missing.length > 0) {
      lastError = `字段缺失:${first.missing.join(', ')}`
      // 重试一次,告诉 AI 缺了什么字段
      const retryRaw = await chatCompletion({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        model: config.model,
        system: `${system}
注意:上次返回缺少这些必填字段:${first.missing.join(', ')},请补全后重新输出完整 JSON。identity.period_name、cards(至少1张)、poster.headline 是必填,必须全部包含。`,
        user: userData,
        capability,
        maxTokens: 8192,
        timeoutMs: 240000,
      })
      const second = tryParse(retryRaw)
      if (second.report) {
        report = second.report
      } else if (second.missing.length > 0) {
        lastError = `字段缺失:${second.missing.join(', ')}`
      }
    } else if (!lastError) {
      lastError = 'JSON 解析失败'
    }
    if (!report) {
      // 透出真实错误(缺失字段/超时/JSON 解析失败),方便排查
      return { ok: false, error: `AI 生成失败:${lastError || '未知原因'}` }
    }
    // 仅当报告包含 AI 原创字段时才算成功,否则重试也失败
    const hasAiFields = report.identity || report.cards?.length || report.poster || report.insights?.length
    if (!hasAiFields) {
      return { ok: false, error: 'AI 返回缺少文案字段,请重试' }
    }

    await saveReportCache(period, facts, report)
    // 追加到报告档案馆(历史可回看,离线可看)
    await addReportToArchive(report)
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
