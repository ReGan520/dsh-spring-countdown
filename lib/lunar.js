/**
 * 春节倒计时的核心计算层。
 *
 * 纯函数、零第三方依赖，Host 端（工具）与 Client 端（侧栏面板）共用同一套
 * 口径：日期表、干支、倒计时、假期区间都在这里定义。
 *
 * 春节日期以 lunar-javascript（6tail/lunar）为准，并与国务院办公厅
 * 《关于 2027 年部分节假日安排的通知》交叉校验：
 * 2027-02-05 为农历除夕（腊月廿九），2027-02-06 为正月初一。
 * 注意：不要用 Intl 的 chinese 日历反推春节 —— ICU 在 2027、2030 等年份
 * 与权威历书相差一天，实测 2027 会算成 02-07。
 */

const DAY_MS = 86400000

export const DEFAULT_TIMEZONE = 'Asia/Shanghai'

/** 公历年 -> 该年春节（正月初一）的公历日期。范围 2000-2050。 */
export const SPRING_TABLE = {
  2000: '2000-02-05', 2001: '2001-01-24', 2002: '2002-02-12', 2003: '2003-02-01',
  2004: '2004-01-22', 2005: '2005-02-09', 2006: '2006-01-29', 2007: '2007-02-18',
  2008: '2008-02-07', 2009: '2009-01-26', 2010: '2010-02-14', 2011: '2011-02-03',
  2012: '2012-01-23', 2013: '2013-02-10', 2014: '2014-01-31', 2015: '2015-02-19',
  2016: '2016-02-08', 2017: '2017-01-28', 2018: '2018-02-16', 2019: '2019-02-05',
  2020: '2020-01-25', 2021: '2021-02-12', 2022: '2022-02-01', 2023: '2023-01-22',
  2024: '2024-02-10', 2025: '2025-01-29', 2026: '2026-02-17', 2027: '2027-02-06',
  2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03', 2031: '2031-01-23',
  2032: '2032-02-11', 2033: '2033-01-31', 2034: '2034-02-19', 2035: '2035-02-08',
  2036: '2036-01-28', 2037: '2037-02-15', 2038: '2038-02-04', 2039: '2039-01-24',
  2040: '2040-02-12', 2041: '2041-02-01', 2042: '2042-01-22', 2043: '2043-02-10',
  2044: '2044-01-30', 2045: '2045-02-17', 2046: '2046-02-06', 2047: '2047-01-26',
  2048: '2048-02-14', 2049: '2049-02-02', 2050: '2050-01-23',
}

/**
 * 已公布放假安排的年份。除夕到正月初八、共 9 天是 2027 年的官方口径；
 * 其余年份退回「除夕 ~ 正月初七」的惯例估算，并在输出里标注 estimated。
 */
export const HOLIDAY_TABLE = {
  2027: { start: '2027-02-05', end: '2027-02-13', days: 9, source: '国办发明电〔2026〕10号' },
}

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
const CN_DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 1 -> 一, 10 -> 十, 21 -> 廿一, 30 -> 三十 */
export function toChineseNumber(n) {
  if (n === 0) return '〇'
  if (n < 10) return CN_DIGITS[n]
  if (n === 10) return '十'
  if (n < 20) return `十${CN_DIGITS[n % 10]}`
  if (n < 30) return n === 20 ? '二十' : `廿${CN_DIGITS[n % 10]}`
  if (n === 30) return '三十'
  return String(n)
}

function mod(n, m) {
  return ((n % m) + m) % m
}

/** 农历年的干支、生肖。农历年序号即其春节所在的公历年。 */
export function lunarYearInfo(lunarYear) {
  const stem = STEMS[mod(lunarYear - 4, 10)]
  const branch = BRANCHES[mod(lunarYear - 4, 12)]
  const zodiac = ZODIACS[mod(lunarYear - 4, 12)]
  return { year: lunarYear, stem, branch, zodiac, label: `${stem}${branch}年`, fullLabel: `${stem}${branch}年 · ${zodiac}年` }
}

const offsetFormatters = new Map()
function offsetFormatter(timezone) {
  let f = offsetFormatters.get(timezone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
    offsetFormatters.set(timezone, f)
  }
  return f
}

/** 指定时区在该时刻的 UTC 偏移（分钟）。东八区为 480。 */
export function timezoneOffsetMinutes(timezone, ts) {
  const formatter = offsetFormatter(timezone)
  const part = formatter.formatToParts(new Date(ts)).find((p) => p.type === 'timeZoneName')
  const raw = part ? part.value : 'GMT'
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(raw)
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  return sign * (Number(m[2]) * 60 + Number(m[3] || 0))
}

const partsFormatters = new Map()
function partsFormatter(timezone) {
  let f = partsFormatters.get(timezone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatters.set(timezone, f)
  }
  return f
}

/** 把时间戳拆成指定时区的日历字段。 */
export function localParts(ts, timezone = DEFAULT_TIMEZONE) {
  const bag = {}
  for (const p of partsFormatter(timezone).formatToParts(new Date(ts))) {
    if (p.type !== 'literal') bag[p.type] = p.value
  }
  const year = Number(bag.year)
  const month = Number(bag.month)
  const day = Number(bag.day)
  return {
    year,
    month,
    day,
    hour: Number(bag.hour) % 24,
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekday: WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()],
    dayNumber: dayNumber(year, month, day),
  }
}

/** 公历日期 -> 连续日序号，用来做「相隔几天」的减法。 */
export function dayNumber(year, month, day) {
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}

/** 连续日序号 -> 公历日期字段。 */
export function fromDayNumber(n) {
  const d = new Date(n * DAY_MS)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** 指定时区里某天 00:00 的时间戳。 */
export function localMidnight(year, month, day, timezone = DEFAULT_TIMEZONE) {
  const naive = Date.UTC(year, month - 1, day)
  let ts = naive - timezoneOffsetMinutes(timezone, naive) * 60000
  const settled = timezoneOffsetMinutes(timezone, ts)
  if (settled !== timezoneOffsetMinutes(timezone, naive)) {
    ts = naive - settled * 60000
  }
  return ts
}

/** 解析 'YYYY-MM-DD' 为日序号。 */
export function parseDayNumber(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return dayNumber(y, m, d)
}

/** 取某公历年的春节。 */
export function springOf(year) {
  const iso = SPRING_TABLE[year]
  if (!iso) {
    throw new RangeError(`春节日期表只覆盖 2000-2050 年，收到 ${year}`)
  }
  const n = parseDayNumber(iso)
  return { year, iso, dayNumber: n, ...fromDayNumber(n), lunarYear: lunarYearInfo(year) }
}

function formatDate(cn) {
  return `${cn.month}月${cn.day}日`
}

/** 把毫秒差拆成天/时/分/秒。 */
export function splitDuration(ms) {
  const clamped = Math.max(0, ms)
  const days = Math.floor(clamped / DAY_MS)
  const hours = Math.floor((clamped % DAY_MS) / 3600000)
  const minutes = Math.floor((clamped % 3600000) / 60000)
  const seconds = Math.floor((clamped % 60000) / 1000)
  return { days, hours, minutes, seconds, totalMs: clamped }
}

function holidayWindow(spring) {
  const official = HOLIDAY_TABLE[spring.year]
  if (official) {
    return {
      start: official.start,
      end: official.end,
      days: official.days,
      estimated: false,
      source: official.source,
    }
  }
  const startNum = spring.dayNumber - 1
  const endNum = spring.dayNumber + 6
  return {
    start: isoOf(startNum),
    end: isoOf(endNum),
    days: 8,
    estimated: true,
    source: '按除夕至正月初七估算',
  }
}

function isoOf(dayNum) {
  const p = fromDayNumber(dayNum)
  const pad = (v) => String(v).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/**
 * 计算一次完整的倒计时快照。
 * @param {{ now?: number|string|Date, timezone?: string }} options
 */
export function buildCountdown(options = {}) {
  const timezone = options.timezone || DEFAULT_TIMEZONE
  const nowTs = options.now === undefined ? Date.now() : new Date(options.now).getTime()
  if (!Number.isFinite(nowTs)) {
    throw new TypeError(`无法解析时间：${String(options.now)}`)
  }

  const today = localParts(nowTs, timezone)

  // 一个春节周期要活到假期结束，而不是到初一为止：正月初三的人想看的是
  // 「假期第 3 天、还剩 5 天」，不是「距下一个春节还有 358 天」。
  let targetYear = today.year
  let spring = springOf(targetYear)
  if (today.dayNumber > parseDayNumber(holidayWindow(spring).end)) {
    targetYear += 1
    spring = springOf(targetYear)
  }

  const eveNum = spring.dayNumber - 1
  const eveIso = isoOf(eveNum)
  const eveMidnight = localMidnight(spring.year, spring.month, spring.day, timezone) - DAY_MS
  const dayMidnight = localMidnight(spring.year, spring.month, spring.day, timezone)

  const eve = {
    key: 'eve',
    name: '除夕',
    date: eveIso,
    display: formatDate(fromDayNumber(eveNum)),
    weekday: WEEKDAYS[new Date(eveNum * DAY_MS).getUTCDay()],
    lunarLabel: `腊月${toChineseNumber(29)}`,
    daysAway: eveNum - today.dayNumber,
    at: eveMidnight,
    ...splitDuration(eveMidnight - nowTs),
  }
  eve.remaining = splitDuration(eveMidnight - nowTs)
  eve.isToday = eve.daysAway === 0

  const day = {
    key: 'day',
    name: '初一',
    date: spring.iso,
    display: formatDate(spring),
    weekday: WEEKDAYS[new Date(spring.dayNumber * DAY_MS).getUTCDay()],
    lunarLabel: '正月初一',
    daysAway: spring.dayNumber - today.dayNumber,
    at: dayMidnight,
    ...splitDuration(dayMidnight - nowTs),
  }
  day.remaining = splitDuration(dayMidnight - nowTs)
  day.isToday = day.daysAway === 0

  // 关键节点：小年 = 春节前 7 天（腊月廿三），元宵 = 春节后 14 天（正月十五）。
  const milestones = [
    { key: 'little-new-year', name: '小年', dayNumber: spring.dayNumber - 7, lunarLabel: '腊月廿三' },
    { key: 'eve', name: '除夕', dayNumber: eveNum, lunarLabel: eve.lunarLabel },
    { key: 'spring', name: '春节', dayNumber: spring.dayNumber, lunarLabel: '正月初一' },
    { key: 'lantern', name: '元宵', dayNumber: spring.dayNumber + 14, lunarLabel: '正月十五' },
  ].map((m) => {
    const c = fromDayNumber(m.dayNumber)
    return {
      key: m.key,
      name: m.name,
      date: isoOf(m.dayNumber),
      display: formatDate(c),
      lunarLabel: m.lunarLabel,
      daysAway: m.dayNumber - today.dayNumber,
      passed: m.dayNumber < today.dayNumber,
    }
  })

  const window = holidayWindow(spring)
  const startNum = parseDayNumber(window.start)
  const endNum = parseDayNumber(window.end)
  let phase = 'before'
  if (today.dayNumber > endNum) phase = 'after'
  else if (today.dayNumber >= startNum) phase = 'during'
  const holiday = {
    ...window,
    phase,
    startsInDays: startNum - today.dayNumber,
    endsInDays: endNum - today.dayNumber,
    dayIndex: phase === 'during' ? today.dayNumber - startNum + 1 : null,
    remainingDays: phase === 'during' ? endNum - today.dayNumber : null,
    totalDays: window.days,
  }

  // 进度：上一个春节到下一个春节之间已经走过的比例。
  const prevSpring = springOf(targetYear - 1)
  const span = spring.dayNumber - prevSpring.dayNumber
  const elapsed = today.dayNumber - prevSpring.dayNumber
  const progress = {
    ratio: span > 0 ? Math.min(1, Math.max(0, elapsed / span)) : 0,
    from: prevSpring.iso,
    to: spring.iso,
    elapsedDays: elapsed,
    totalDays: span,
  }

  return {
    timezone,
    now: new Date(nowTs).toISOString(),
    nowLocal: `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')} ${String(today.hour).padStart(2, '0')}:${String(today.minute).padStart(2, '0')}:${String(today.second).padStart(2, '0')}`,
    today: { year: today.year, month: today.month, day: today.day, weekday: today.weekday },
    lunarYear: spring.lunarYear,
    targets: { eve, day },
    primary: eve.daysAway >= 0 ? 'eve' : 'day',
    milestones,
    holiday,
    progress,
  }
}

/** 文本进度条。 */
export function progressBar(ratio, width = 18) {
  const filled = Math.round(Math.min(1, Math.max(0, ratio)) * width)
  return `${'▓'.repeat(filled)}${'░'.repeat(width - filled)}`
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/**
 * 把快照渲染成一张终端可读的卡片（工具结果的 render 用它）。
 */
export function formatCard(data) {
  const { eve, day } = data.targets
  const lines = []

  lines.push(`🧧 ${data.lunarYear.year} ${data.lunarYear.fullLabel} · 春节倒计时`)
  lines.push('')

  const describe = (t) => {
    if (t.isToday) return '就是今天'
    if (t.daysAway < 0) return `已过 ${Math.abs(t.daysAway)} 天`
    const { hours, minutes, seconds } = t.remaining
    if (t.daysAway === 0) return `还有 ${hours} 小时 ${pad2(minutes)} 分 ${pad2(seconds)} 秒`
    return `还有 ${t.daysAway} 天 ${hours} 小时 ${pad2(minutes)} 分 ${pad2(seconds)} 秒`
  }

  lines.push(`  ${eve.name}  ${eve.date} ${eve.weekday} · ${eve.lunarLabel}`)
  lines.push(`        ${describe(eve)}`)
  lines.push(`  ${day.name}  ${day.date} ${day.weekday} · ${day.lunarLabel}`)
  lines.push(`        ${describe(day)}`)
  lines.push('')

  const pct = Math.round(data.progress.ratio * 100)
  lines.push(`  这一轮春节已过 ${progressBar(data.progress.ratio)} ${pct}%`)
  lines.push('')

  const upcoming = data.milestones.find((m) => !m.passed)
  const bits = []
  if (upcoming) bits.push(`下一个节点 ${upcoming.name} ${upcoming.display}（${upcoming.daysAway} 天后）`)

  const h = data.holiday
  const holidayLine =
    h.phase === 'during'
      ? `假期进行中：第 ${h.dayIndex}/${h.totalDays} 天，还剩 ${h.remainingDays} 天`
      : h.phase === 'before'
        ? `假期 ${h.start} ~ ${h.end}（${h.totalDays} 天），${h.startsInDays} 天后开始`
        : `今年假期已结束（${h.start} ~ ${h.end}）`
  bits.push(holidayLine)
  if (h.estimated) bits.push('（假期天数按惯例估算）')

  for (const b of bits) lines.push(`  · ${b}`)

  return lines.join('\n')
}
