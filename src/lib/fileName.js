const p2 = (n) => String(n).padStart(2, '0')

export function exportFileName(date, prefix = 'lilim-strip', ext = 'png') {
  const y = String(date.getFullYear()).padStart(4, '0')
  const d = `${y}${p2(date.getMonth() + 1)}${p2(date.getDate())}`
  const t = `${p2(date.getHours())}${p2(date.getMinutes())}${p2(date.getSeconds())}`
  return `${prefix}-${d}-${t}.${ext}`
}
