import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { defineCube } from '../GreenCube.ts'

describe('defineCube', () => {
  it('returns an object with name and definition merged', () => {
    const c = defineCube('Orders', {
      sql: 'analytics.orders o',
      dimensions: { id: { sql: 'o.id', type: 'number' } },
      measures: { count: { sql: 'o.id', type: 'count' } },
    })
    assert.equal(c.name, 'Orders')
    assert.equal(c.sql, 'analytics.orders o')
    assert.equal(Object.keys(c.dimensions).length, 1)
    assert.equal(Object.keys(c.measures).length, 1)
  })
})

// parseMember and extractAlias are unexported — tested indirectly
// through CubeQueryCompiler.compile() validation.
