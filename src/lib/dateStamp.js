const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Format a date as "MMM D, YYYY" (e.g. "Nov 13, 2026") using local date parts.
 * Pure. Uses a fixed English month table, no Intl.
 * @param {Date} date
 * @returns {string}
 */
export function formatDateStamp(date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

function daysInMonth(year, month) {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return leap ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/**
 * Parse a "MMM D, YYYY" string.
 * @param {string} str
 * @returns {{ year: number, month: number, day: number } | null} month is 1..12
 */
export function parseDateStamp(str) {
  if (typeof str !== 'string') return null
  const m = /^([A-Z][a-z]{2}) (0|[1-9]\d?), (\d{4})$/.exec(str)
  if (!m) return null
  const month = MONTHS.indexOf(m[1]) + 1
  if (month === 0) return null
  const day = Number(m[2])
  const year = Number(m[3])
  if (day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}
