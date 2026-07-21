import { describe, it } from 'node:test'
import assert from 'node:assert'
import { validateQuery } from '../GreenCube.ts'
import { defineCube } from '../GreenCube.ts'
import type { Cube } from '../GreenCube.ts'

// Minimal test schema
const orders = defineCube('Orders', {
  sql: 'analytics.orders o',
  dimensions: {
    id: { sql: 'o.id', type: 'number' },
    status: { sql: 'o.status', type: 'string' },
    ordered_at: { sql: 'o.ordered_at', type: 'time' },
  },
  measures: {
    count: { sql: 'o.id', type: 'count', title: 'Orders' },
    total: { sql: 'o.total', type: 'sum', title: 'Revenue' },
    avg_total: { sql: 'o.total', type: 'avg', title: 'Average Order Value' },
  },
})

const customers = defineCube('Customers', {
  sql: 'analytics.customers c',
  dimensions: {
    id: { sql: 'c.id', type: 'number' },
    name: { sql: 'c.name', type: 'string', title: 'Customer Name' },
    country: { sql: 'c.country', type: 'string' },
    created_at: { sql: 'c.created_at', type: 'time' },
  },
  measures: {
    count: { sql: 'c.id', type: 'count', title: 'Customers' },
  },
})

function cubeMap(...cubes: Cube[]): Map<string, Cube> {
  const m = new Map<string, Cube>()
  for (const c of cubes) m.set(c.name, c)
  return m
}

const cubes = cubeMap(orders, customers)

describe('validateQuery', () => {
  it('passes for valid query', () => {
    const result = validateQuery(cubes, {
      measures: ['Orders.count'],
      dimensions: ['Orders.status'],
    })
    assert.equal(result.valid, true)
    assert.equal(result.errors.length, 0)
  })

  it('fails for unknown cube', () => {
    const result = validateQuery(cubes, {
      measures: ['Unknown.count'],
    })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.type === 'cube_not_found'))
  })

  it('fails for unknown measure', () => {
    const result = validateQuery(cubes, {
      measures: ['Orders.nonexistent'],
    })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.type === 'measure_not_found'))
  })

  it('fails for unknown dimension', () => {
    const result = validateQuery(cubes, {
      measures: ['Orders.count'],
      dimensions: ['Orders.nonexistent'],
    })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.type === 'dimension_not_found'))
  })

  it('validates time dimension type', () => {
    const result = validateQuery(cubes, {
      measures: ['Orders.count'],
      timeDimensions: [{ dimension: 'Orders.status', granularity: 'month' }],
    })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.type === 'time_dimension_not_found'))
  })

  it('suggests close matches for typos', () => {
    const result = validateQuery(cubes, {
      measures: ['Orders.cout'],  // typo
    })
    assert.equal(result.valid, false)
    const err = result.errors.find(e => e.type === 'measure_not_found')
    assert.ok(err)
    assert.ok(err!.suggestion)
  })

  it('validates time dimensions correctly', () => {
    const result = validateQuery(cubes, {
      measures: ['Orders.count'],
      timeDimensions: [{ dimension: 'Orders.ordered_at', granularity: 'month' }],
    })
    assert.equal(result.valid, true)
  })
})
