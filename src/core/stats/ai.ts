/**
 * AI 分析层:BYOK,OpenAI 兼容 /chat/completions
 */
import settingState from '@/store/setting/state'

export const AI_TONES: { id: LX.AiTone; name: string }[] = [
  { id: 'friend', name: '老朋友' },
  { id: 'sharp', name: '毒舌' },
  { id: 'gentle', name: '温柔' },
  { id: 'minimal', name: '极简' },
  { id: 'formal', name: '正经报告' },
]

export const getAiToneName = (tone: LX.AiTone) =>
  AI_TONES.find((item) => item.id === tone)?.name ?? '老朋友'

export const AI_PROVIDERS: { id: string; name: string; endpoint: string; model: string }[] = [
  { id: 'deepseek', name: 'DeepSeek', endpoint: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { id: 'openrouter', name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1', model: '' },
  { id: 'ollama', name: 'Ollama', endpoint: 'http://127.0.0.1:11434/v1', model: 'qwen2.5' },
  { id: 'tongyi', name: '通义千问', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'kimi', name: 'Kimi', endpoint: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
]

export const AI_PROVIDER_CAPABILITY: Record<string, 'none' | 'json_object' | 'json_schema'> = {
  deepseek: 'json_object',
  openrouter: 'json_schema',
  ollama: 'json_schema',
  tongyi: 'json_object',
  kimi: 'json_schema',
}

export const getAiConfig = () => {
  const s = settingState.setting
  return {
    endpoint: s['common.aiEndpoint'] ?? '',
    apiKey: s['common.aiApiKey'] ?? '',
    nickname: s['common.aiNickname'] ?? '',
    tone: s['common.aiTone'] ?? ('friend' as LX.AiTone),
    model: s['common.aiModel'] ?? '',
  }
}

export const buildAiSystemPrompt = (extra?: string) => {
  const config = getAiConfig()
  const nickname = config.nickname.trim() || '你'
  const tone = getAiToneName(config.tone)
  return `称呼:${nickname} | 语气:${tone} | 约束:只输出 JSON,不要 Markdown 代码块;所有数字/日期/歌名必须来自给定数据,一个都不能编;语气可以活泼,但事实必须诚实。${extra ? `\n${extra}` : ''}`
}

const normalizeChatUrl = (endpoint: string) => {
  const base = endpoint.trim().replace(/\/+$/, '')
  if (!base) throw new Error('请先填写 Endpoint')
  return `${base}/chat/completions`
}

export const chatCompletion = async (params: {
  endpoint: string
  apiKey: string
  model: string
  system: string
  user: string
  capability?: 'none' | 'json_object' | 'json_schema'
  maxTokens?: number
  timeoutMs?: number
}): Promise<string> => {
  const { endpoint, apiKey, model, system, user } = params
  if (!endpoint.trim()) throw new Error('请先填写 Endpoint')
  if (!model.trim()) throw new Error('请先填写模型名称')

  const url = normalizeChatUrl(endpoint)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`

  const body: Record<string, unknown> = {
    model: model.trim(),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: params.maxTokens ?? 8192,
    stream: false,
    temperature: 1.0,
  }
  const capability = params.capability ?? 'none'
  if (capability === 'json_schema' || capability === 'json_object') {
    body.response_format = { type: 'json_object' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 120000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify(body),
    })
    const raw = await res.text()
    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      throw new Error(`响应不是有效 JSON(HTTP ${res.status}):${raw.slice(0, 200) || '空响应'}`)
    }
    if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`)
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      const reason = data?.choices?.[0]?.finish_reason
      throw new Error(`模型返回内容为空${reason ? `(finish_reason=${reason})` : ''},请重试`)
    }
    return content.trim()
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('请求超时,请稍后重试')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const testAiConnection = async (timeoutMs = 20000): Promise<string> => {
  const config = getAiConfig()
  if (!config.endpoint.trim()) throw new Error('请先填写 Endpoint')
  if (!config.model.trim()) throw new Error('请先填写模型名称')
  const url = normalizeChatUrl(config.endpoint)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model.trim(),
        messages: [
          { role: 'system', content: '你是连接测试助手。这是连通性测试,直接回复两个字"成功",不要思考、不要解释。' },
          { role: 'user', content: 'ping' },
        ],
        max_tokens: 512,
        stream: false,
      }),
    })
    const raw = await res.text()
    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      throw new Error(`响应不是有效 JSON(HTTP ${res.status}):${raw.slice(0, 200) || '空响应'}`)
    }
    if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`)
    const content = data?.choices?.[0]?.message?.content
    if (typeof content === 'string' && content.trim()) return content.trim()
    const reasoning = data?.choices?.[0]?.message?.reasoning_content
    if (Array.isArray(data?.choices) && data.choices.length > 0 && reasoning) return '成功(连接可用)'
    throw new Error('模型返回内容为空')
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('连接超时,请检查 Endpoint 或网络')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
