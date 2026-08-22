export const getTimeGreeting = (now: Date = new Date()): string => {
  const hours = now.getHours()

  if (hours >= 0 && hours <= 4) {
    return '深夜，现在的夜，熬得只是还未改变的习惯'
  } else if (hours >= 5 && hours <= 10) {
    return '早安，清晨熹微的阳光，是你在微笑吗'
  } else if (hours >= 11 && hours <= 13) {
    return '午好，伴随着熟悉的乐曲，聆听着动人的旋律'
  } else if (hours >= 14 && hours <= 17) {
    return '夕暮，似清风醉晚霞，不经意间盈笑回眸'
  } else if (hours >= 18 && hours <= 23) {
    return '夜晚，一个安静的角落，静静地聆听夜曲'
  }
  return ''
}
