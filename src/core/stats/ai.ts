/**
 * AI 分析层(第二版)—— 服务商预设、语气五档、系统 prompt 构造、测试连接
 *
 * 策划依据:策划设计.md 5.1(请求侧)/ 9.7(第二版 AI 接入落点)/ 第十二节功能块①②
 * - BYOK:Endpoint + API Key 用户自填,只存本机
 * - 每次分析都是全新对话,绝不复用旧对话
 * - 服务商能力白名单(App 内置,不运行时探测;②功能块用)
 */
import settingState from '@/store/setting/state'

/** AI 语气偏好五档(2026-08-07 琥珀拍板,默认老朋友) */
export const AI_TONES: { id: LX.AiTone; name: string }[] = [
  { id: 'friend', name: '老朋友' },
  { id: 'sharp', name: '毒舌' },
  { id: 'gentle', name: '温柔' },
  { id: 'minimal', name: '极简' },
  { id: 'formal', name: '正经报告' },
]

export const getAiToneName = (tone: LX.AiTone): string =>
  AI_TONES.find((t) => t.id === tone)?.name ?? '老朋友'

/** 服务商预设(一键填 Endpoint + 推荐模型;API Key 用户自填) */
export const AI_PROVIDERS: {
  id: string
  name: string
  endpoint: string
  model: string
}[] = [
  { id: 'deepseek', name: 'DeepSeek', endpoint: 'https://api.deepseek.com', model: 'deepseek-chat' },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    model: '',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    endpoint: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5',
  },
  {
    id: 'tongyi',
    name: '通义千问(百炼兼容)',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    endpoint: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
]

/**
 * 服务商结构化输出能力白名单(App 内置,不运行时探测)
 * - json_schema:可发 response_format={"type":"json_schema",...}(OpenAI/Kimi/Ollama/OpenRouter 支持端点)
 * - json_object:发 response_format={"type":"json_object"} 且 prompt 必须含 "json" 字样与示例(DeepSeek/通义要求)
 * - none:纯 prompt 约束(基线)
 * 已核实:DeepSeek 不支持 json_schema;通义仅部分高配支持(保守按 json_object)
 */
export const AI_PROVIDER_CAPABILITY: Record<string, 'none' | 'json_object' | 'json_schema'> = {
  deepseek: 'json_object',
  openrouter: 'json_schema',
  ollama: 'json_schema',
  tongyi: 'json_object',
  kimi: 'json_schema',
}

/** 当前 AI 配置(从全局设置读取,核心代码用;组件内请用 useSettingValue) */
export const getAiConfig = () => {
  const setting = settingState.setting
  return {
    endpoint: setting['common.aiEndpoint'] ?? '',
    apiKey: setting['common.aiApiKey'] ?? '',
    nickname: setting['common.aiNickname'] ?? '',
    tone: setting['common.aiTone'] ?? ('friend' as LX.AiTone),
    model: setting['common.aiModel'] ?? '',
  }
}

/**
 * 构造 system prompt(用户自述 + 防编造约束)
 * 格式(策划 5.2 定稿):称呼:小琥珀 | 语气:毒舌 | 约束:…
 * 语气只影响措辞风格,不影响数据——所有数字/日期/歌名必须来自给定数据,一个都不能编
 */
export const buildAiSystemPrompt = (config: {
  nickname?: string
  tone?: LX.AiTone
  extra?: string
}): string => {
  const nickname = config.nickname?.trim() || '你'
  const toneName = getAiToneName(config.tone ?? 'friend')
  const constraint =
    '只输出 JSON,不要 Markdown 代码块;所有数字/日期/歌名必须来自给定数据,一个都不能编;语气可以活泼,但事实必须诚实'
  return `称呼:${nickname} | 语气:${toneName} | 约束:${constraint}${config.extra ? `\n${config.extra}` : ''}`
}

/** 规整 endpoint:去尾部斜杠,再拼 /chat/completions(OpenAI 兼容) */
const normalizeChatUrl = (endpoint: string): string => {
  const base = endpoint.trim().replace(/\/+$/, '')
  if (!base) throw new Error('请先填写 Endpoint')
  return `${base}/chat/completions`
}

/** 测试连接:发最小 chat/completions 请求,验证 Endpoint + Key + Model 可用 */
export const testAiConnection = async (
  config: { endpoint: string; apiKey: string; model: string },
  timeoutMs = 20000
): Promise<string> => {
  const { apiKey, model } = config
  if (!config.endpoint.trim()) throw new Error('请先填写 Endpoint')
  if (!model.trim()) throw new Error('请先填写模型名称')
  const url = normalizeChatUrl(config.endpoint)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: model.trim(),
        messages: [
          {
            role: 'system',
            // 明确要求直接回答,不给推理模型留思考空间(测试连接只验证连通性,不测推理能力)
            content:
              '你是连接测试助手。这是连通性测试,直接回复两个字"成功",不要思考、不要解释、不要输出任何推理过程。',
          },
          { role: 'user', content: 'ping' },
        ],
        // 给足输出空间:推理模型若仍输出 reasoning_content,也足够轮到 content
        max_tokens: 512,
        stream: false,
      }),
    })
    // 先读原始文本,便于区分「非 JSON 响应」与「JSON 但 content 为空」
    const raw = await res.text()
    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      throw new Error(
        `响应不是有效 JSON(HTTP ${res.status}):${raw.slice(0, 200) || '空响应'}`
      )
    }
    if (!res.ok) {
      throw new Error(data?.error?.message ?? `HTTP ${res.status}`)
    }
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      // 推理模型可能把 token 都花在 reasoning_content 上(content 空但连接是通的)
      // 测试连接只验证连通性:只要模型有响应(有 choices/reasoning_content),就算连接成功
      const reasoning = data?.choices?.[0]?.message?.reasoning_content
      const hasResponse = Array.isArray(data?.choices) && data.choices.length > 0
      if (hasResponse && (reasoning || data?.choices?.[0]?.finish_reason === 'length')) {
        return '成功(连接可用)'
      }
      const reason = data?.choices?.[0]?.finish_reason
      const excerpt = raw.slice(0, 300)
      throw new Error(
        `模型返回内容为空${reason ? `(finish_reason=${reason})` : ''},响应:${excerpt}`
      )
    }
    return content.trim()
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('连接超时,请检查 Endpoint 或网络')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
