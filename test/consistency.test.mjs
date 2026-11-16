import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { SPRING_TABLE } from '../lib/lunar.js'

/**
 * 客户端那一半是单文件 ModuleLoader 模块，不能 import 宿主端的 lunar.js，
 * 所以它自己带了一份日期表。这里守住两份数据不分叉 —— 否则侧栏显示的天数
 * 会和模型回答的对不上。
 */
const clientSource = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

function extractObjectLiteral(source, constName) {
  const start = source.indexOf(`const ${constName} = {`)
  assert.notEqual(start, -1, `client.js 里找不到 ${constName}`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  throw new Error(`${constName} 的字面量没有闭合`)
}

test('客户端日期表与宿主端完全一致', () => {
  const literal = extractObjectLiteral(clientSource, 'SPRING_TABLE')
  const clientTable = new Function(`return (${literal})`)()
  assert.deepEqual(clientTable, SPRING_TABLE)
})

test('客户端模块包装格式正确', () => {
  assert.match(clientSource, /window\.__ModuleLoader__\.load\(/)
  assert.match(clientSource, /id: 'dsh-spring-countdown'/)
  assert.match(clientSource, /id: 'spring-countdown'[\s\S]*?name: 'sidebar\.footer\.action'|name: 'sidebar\.footer\.action'/)
})

test('客户端注册的是侧栏底部席位，且不重复占用已发布的 id', () => {
  const ids = [...clientSource.matchAll(/slots\.register\(\s*\{[\s\S]*?id: '([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(ids, ['spring-countdown'])
  const slots = [...clientSource.matchAll(/slots\.inject\('([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(slots, ['sidebar.footer.action'])
})

test('模块只依赖宿主提供的 react 运行时', () => {
  const requires = [...clientSource.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]).sort()
  assert.deepEqual(requires, ['react', 'react-dom'])
})
