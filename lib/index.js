/**
 * Host half of dsh-spring-countdown.
 *
 * 只做一件事：向模型暴露 spring_festival_countdown 工具，让它能回答
 * 「还有多久过年」「除夕是哪天」「春节放几天」这类问题，而不是靠模型
 * 自己掰手指算农历。计算全部落在 ./lunar.js 上。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'

import { DEFAULT_TIMEZONE, buildCountdown, formatCard } from './lunar.js'

export const name = 'dsh-spring-countdown'
export const inject = ['tools']

export const TOOL_NAME = 'spring_festival_countdown'

function describe(data) {
  const { eve, day } = data.targets
  const head = `${data.lunarYear.label}（${data.lunarYear.zodiac}年）春节`
  if (eve.isToday) return `${head}就在今天，今晚除夕。距正月初一还有 ${day.daysAway} 天。`
  return `${head}：距除夕 ${eve.daysAway} 天，距正月初一 ${day.daysAway} 天。`
}

export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: TOOL_NAME,
      description:
        '查询距离下一个春节（过年）的倒计时，同时给出除夕与正月初一两个节点、农历干支生肖、春节假期区间与前后关键节点（小年/元宵）。用户在问“还有多久过年”“离除夕几天”“春节几号”“春节放几天假”时使用。',
      parameters: {
        timezone: {
          type: 'string',
          description: `IANA 时区，默认 ${DEFAULT_TIMEZONE}。用户在海外时传入其所在地，例如 America/New_York。`,
        },
        at: {
          type: 'string',
          description: '以该 ISO 8601 时间点为基准计算，缺省为当前时刻。仅用于换算某个特定日期。',
        },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render(_args, value) {
          return [{ type: 'text', text: formatCard(value) }]
        },
      },
      async execute(args) {
        const options = {}
        if (args && typeof args.timezone === 'string' && args.timezone.trim()) {
          options.timezone = args.timezone.trim()
        }
        if (args && typeof args.at === 'string' && args.at.trim()) {
          options.at = args.at.trim()
        }
        const data = buildCountdown(options)
        return { ...data, summary: describe(data) }
      },
    }),
  )
}
