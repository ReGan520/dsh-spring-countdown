import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  SPRING_TABLE,
  buildCountdown,
  dayNumber,
  formatCard,
  fromDayNumber,
  localMidnight,
  localParts,
  lunarYearInfo,
  springOf,
  toChineseNumber,
} from '../lib/lunar.js'

const TZ = 'Asia/Shanghai'

test('春节日期表与权威历书一致', () => {
  // 国务院办公厅《关于2027年部分节假日安排的通知》：2月5日除夕、2月6日正月初一
  assert.equal(springOf(2027).iso, '2027-02-06')
  assert.equal(buildCountdown({ now: '2027-02-06T12:00:00+08:00' }).targets.day.date, '2027-02-06')
  assert.equal(SPRING_TABLE[2026], '2026-02-17')
  assert.equal(SPRING_TABLE[2028], '2028-01-26')
  // ICU 会算错的年份，表必须顶住
  assert.equal(SPRING_TABLE[2030], '2030-02-03')
  assert.equal(Object.keys(SPRING_TABLE).length, 51)
})

test('干支与生肖', () => {
  assert.deepEqual(lunarYearInfo(2027).label, '丁未年')
  assert.equal(lunarYearInfo(2027).zodiac, '羊')
  assert.equal(lunarYearInfo(2024).label, '甲辰年')
  assert.equal(lunarYearInfo(2024).zodiac, '龙')
  assert.equal(lunarYearInfo(2026).zodiac, '马')
})

test('倒计时口径：距除夕 84 天（2026-11-13）', () => {
  const data = buildCountdown({ now: '2026-11-13T16:40:00+08:00' })
  assert.equal(data.lunarYear.year, 2027)
  assert.equal(data.targets.eve.date, '2027-02-05')
  assert.equal(data.targets.eve.daysAway, 84)
  assert.equal(data.targets.day.daysAway, 85)
  assert.equal(data.targets.eve.lunarLabel, '腊月廿九')
  assert.equal(data.targets.day.lunarLabel, '正月初一')
  assert.equal(data.targets.eve.weekday, '周五')
  assert.equal(data.targets.day.weekday, '周六')
  assert.equal(data.primary, 'eve')
})

test('除夕当天与春节当天', () => {
  const eve = buildCountdown({ now: '2027-02-05T20:00:00+08:00' })
  assert.equal(eve.targets.eve.isToday, true)
  assert.equal(eve.targets.eve.daysAway, 0)
  assert.equal(eve.targets.day.daysAway, 1)
  assert.equal(eve.holiday.phase, 'during')
  assert.equal(eve.holiday.dayIndex, 1)

  const day = buildCountdown({ now: '2027-02-06T08:00:00+08:00' })
  assert.equal(day.targets.day.isToday, true)
  assert.equal(day.targets.day.daysAway, 0)
  assert.equal(day.lunarYear.year, 2027)
})

test('跨年切换：假期结束后指向下一年', () => {
  const after = buildCountdown({ now: '2027-02-20T10:00:00+08:00' })
  assert.equal(after.lunarYear.year, 2028)
  assert.equal(after.targets.day.date, '2028-01-26')
  assert.equal(after.progress.to, '2028-01-26')
})

test('假期期间停在当前周期，假期结束后翻页', () => {
  const mid = buildCountdown({ now: '2027-02-10T10:00:00+08:00' })
  assert.equal(mid.lunarYear.year, 2027)
  assert.equal(mid.holiday.phase, 'during')
  assert.equal(mid.holiday.dayIndex, 6)
  assert.equal(mid.holiday.remainingDays, 3)
  assert.equal(mid.targets.day.daysAway, -4)

  const done = buildCountdown({ now: '2027-02-14T10:00:00+08:00' })
  assert.equal(done.lunarYear.year, 2028)
  assert.equal(done.holiday.phase, 'before')
  assert.equal(done.holiday.estimated, true)
  assert.equal(done.holiday.totalDays, 8)
})

test('关键节点：小年、除夕、初一、元宵', () => {
  const data = buildCountdown({ now: '2026-11-13T16:40:00+08:00' })
  const byKey = Object.fromEntries(data.milestones.map((m) => [m.key, m]))
  assert.equal(byKey['little-new-year'].date, '2027-01-30')
  assert.equal(byKey.eve.date, '2027-02-05')
  assert.equal(byKey.spring.date, '2027-02-06')
  assert.equal(byKey.lantern.date, '2027-02-20')
  assert.equal(byKey.lantern.lunarLabel, '正月十五')
})

test('时区换算：纽约的当地日期与零点', () => {
  const ny = buildCountdown({ now: '2026-11-13T16:40:00-05:00', timezone: 'America/New_York' })
  assert.equal(ny.timezone, 'America/New_York')
  assert.equal(ny.today.month, 11)
  assert.equal(ny.today.day, 13)
  // 纽约 2027-02-05 00:00 是 UTC 05:00
  const midnight = localMidnight(2027, 2, 5, 'America/New_York')
  assert.equal(new Date(midnight).toISOString(), '2027-02-05T05:00:00.000Z')
})

test('日历日序号与逆向还原自洽', () => {
  const n = dayNumber(2027, 2, 6)
  assert.deepEqual(fromDayNumber(n), { year: 2027, month: 2, day: 6 })
  assert.equal(dayNumber(2026, 11, 13) + 84, dayNumber(2027, 2, 5))
  const parts = localParts(Date.parse('2026-11-13T16:40:00+08:00'), TZ)
  assert.equal(parts.dayNumber, dayNumber(2026, 11, 13))
})

test('中文数字与卡片渲染', () => {
  assert.equal(toChineseNumber(23), '廿三')
  assert.equal(toChineseNumber(29), '廿九')
  assert.equal(toChineseNumber(15), '十五')
  assert.equal(toChineseNumber(10), '十')
  const card = formatCard(buildCountdown({ now: '2026-11-13T16:40:00+08:00' }))
  assert.match(card, /丁未年 · 羊年/)
  assert.match(card, /还有 84 天/)
  assert.match(card, /腊月廿九/)
})

test('非法年份给出明确错误', () => {
  assert.throws(() => springOf(1999), /2000-2050/)
  assert.throws(() => buildCountdown({ now: 'not-a-date' }), /无法解析时间/)
})
