import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SqlExpr, sql, raw, ident, isSqlExpr } from '../GreenCube.ts'

describe('SqlExpr', () => {
  it('constructs with text and optional params', () => {
    const e = new SqlExpr('o.id = ?', [42])
    assert.equal(e.text, 'o.id = ?')
    assert.deepEqual(e.params, [42])
  })

  it('defaults params to empty array', () => {
    const e = new SqlExpr('1=1')
    assert.equal(e.text, '1=1')
    assert.deepEqual(e.params, [])
  })
})

describe('sql tagged template', () => {
  it('inlines plain values as ? placeholders', () => {
    const e = sql`WHERE status = ${'completed'}`
    assert.equal(e.text, 'WHERE status = ?')
    assert.deepEqual(e.params, ['completed'])
  })

  it('inlines SqlExpr values and merges their params', () => {
    const col = raw('o.id')
    const e = sql`COUNT(${col})`
    assert.equal(e.text, 'COUNT(o.id)')
    assert.deepEqual(e.params, [])
  })

  it('merges SqlExpr params with surrounding values', () => {
    const field = raw('o.status')
    const e = sql`${field} = ${'active'} AND o.total > ${100}`
    assert.equal(e.text, 'o.status = ? AND o.total > ?')
    assert.deepEqual(e.params, ['active', 100])
  })

  it('handles nested SqlExpr objects', () => {
    const inner = sql`${raw('o.total')} > ${50}`
    const outer = sql`SELECT * FROM t WHERE ${inner}`
    assert.equal(outer.text, 'SELECT * FROM t WHERE o.total > ?')
    assert.deepEqual(outer.params, [50])
  })

  it('produces empty SqlExpr for empty template', () => {
    const e = sql``
    assert.equal(e.text, '')
    assert.deepEqual(e.params, [])
  })
})

describe('raw', () => {
  it('returns a SqlExpr with the exact text and no params', () => {
    const e = raw('ANY SQL HERE')
    assert.equal(e.text, 'ANY SQL HERE')
    assert.deepEqual(e.params, [])
  })
})

describe('ident', () => {
  it('double-quotes a simple name', () => {
    assert.equal(ident('Orders.id').text, '"Orders.id"')
  })

  it('escapes embedded double-quotes', () => {
    assert.equal(ident('he"llo').text, '"he""llo"')
  })
})

describe('isSqlExpr', () => {
  it('returns true for SqlExpr instances', () => {
    assert.equal(isSqlExpr(new SqlExpr('x')), true)
  })

  it('returns false for other types', () => {
    assert.equal(isSqlExpr('x'), false)
    assert.equal(isSqlExpr(42), false)
    assert.equal(isSqlExpr(null), false)
    assert.equal(isSqlExpr({ text: 'x', params: [] }), false)
  })
})
