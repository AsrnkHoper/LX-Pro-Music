const pad2 = (n: number) => String(n).padStart(2, '0')
const pad3 = (n: number) => String(n).padStart(3, '0')

export const msToLrcTime = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms))
  return `${pad2(Math.floor(total / 60000))}:${pad2(Math.floor((total % 60000) / 1000))}.${pad3(total % 1000)}`
}

const padFrac = (frac: string): number => {
  if (!frac) return 0
  const padded = frac.length === 1 ? frac + '00' : frac.length === 2 ? frac + '0' : frac.slice(0, 3)
  return parseInt(padded, 10)
}

export const lrcTimeToMs = (tag: string): number => {
  const m = tag.match(/^(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?$/)
  if (!m) return 0
  return parseInt(m[1], 10) * 60000 + parseInt(m[2], 10) * 1000 + padFrac(m[3] ?? '')
}

export const fullTimeToMs = (t: string): number => {
  const m = t.match(/^(\d+):(\d{2}):(\d{2})[.,](\d{1,3})$/)
  if (!m) return 0
  return parseInt(m[1], 10) * 3600000 + parseInt(m[2], 10) * 60000 + parseInt(m[3], 10) * 1000 + padFrac(m[4])
}





