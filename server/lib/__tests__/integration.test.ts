import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { before, describe, it } from 'node:test'
import { SqliteDialect } from '../dialects/SqliteDialect.ts'
import type { CompiledQuery, Cube, Query } from '../GreenCube.ts'
import { CubeQueryCompiler } from '../GreenCube.ts'
import * as cubeDefs from './cubes.ts'
import { seed } from './seeds.ts'

function makeSqliteCubes(): Map<string, Cube> {
  const orig = Object.values(cubeDefs).filter(v => typeof v !== 'function') as Cube[]
  const map = new Map<string, Cube>()
  for (const c of orig) map.set(c.name, { ...c, measures: { ...c.measures } })
  for (const cube of map.values()) {
    for (const [mName, measure] of Object.entries(cube.measures)) {
      if (measure.sql && typeof measure.sql === 'string') {
        (cube.measures as any)[mName] = {
          ...measure,
          sql: measure.sql.replace(
            /DATEDIFF\('day',\s*([^,]+),\s*([^)]+)\)/g,
            'JULIANDAY($2) - JULIANDAY($1)',
          ),
        }
      }
    }
  }
  return map
}

function compile(cubes: Map<string, Cube>, query: Query): CompiledQuery {
  return new CubeQueryCompiler(cubes, new SqliteDialect()).compile(query)
}

function execSql(db: Database.Database, compiled: CompiledQuery): Record<string, unknown>[] {
  const stmt = db.prepare(compiled.sql)
  return stmt.all(...compiled.params) as Record<string, unknown>[]
}

let db: Database.Database
let cubes: Map<string, Cube>

before(() => {
  db = new Database(':memory:')
  seed(db)
  cubes = makeSqliteCubes()
})

describe('SQLite integration', () => {
  it('simple count', () => {
    const compiled = compile(cubes, { measures: ['Orders.count'] })
    const rows = execSql(db, compiled)
    assert.equal(rows.length, 1)
    assert.equal(Number(rows[0]['Orders.count']), 14)
  })

  it('count with group by', () => {
    const compiled = compile(cubes, {
      measures: ['Orders.count'],
      dimensions: ['Orders.status'],
    })
    const rows = execSql(db, compiled)
    assert.equal(rows.length, 4)
    const completed = rows.find(r => r['Orders.status'] === 'completed')
    assert.ok(completed)
    assert.equal(Number(completed['Orders.count']), 8)
  })

  it('sum measure', () => {
    const compiled = compile(cubes, { measures: ['OrderItems.revenue'] })
    const rows = execSql(db, compiled)
    assert.equal(rows.length, 1)
    const rev = Number(rows[0]['OrderItems.revenue'])
    assert.equal(rev, 1145.83)
  })

  it('filter with equals and placeholder', () => {
    const compiled = compile(cubes, {
      measures: ['Orders.count'],
      filters: [{ member: 'Orders.status', operator: 'equals', values: ['completed'] }],
    })
    const rows = execSql(db, compiled)
    assert.equal(Number(rows[0]['Orders.count']), 8)
  })

  it('count distinct', () => {
    const compiled = compile(cubes, {
      measures: ['Customers.countries'],
    })
    const rows = execSql(db, compiled)
    // US, MX, DE (Elena has null, Frank and Hans are deleted)
    assert.equal(Number(rows[0]['Customers.countries']), 3)
  })

  it('join Customers → Orders via belongsTo', () => {
    const compiled = compile(cubes, {
      measures: ['Orders.count'],
      dimensions: ['Customers.country'],
    })
    const rows = execSql(db, compiled)
    // Alice(US):2 + Bob(US):2 = 4, Carlos(MX):2, Diana(DE):2 + Grace(DE):2 = 4, Elena(null):2
    const us = rows.find(r => r['Customers.country'] === 'US')
    assert.ok(us)
    assert.equal(Number(us['Orders.count']), 4)
    const mx = rows.find(r => r['Customers.country'] === 'MX')
    assert.ok(mx)
    assert.equal(Number(mx['Orders.count']), 2)
    const de = rows.find(r => r['Customers.country'] === 'DE')
    assert.ok(de)
    assert.equal(Number(de['Orders.count']), 4)
  })

  it('time dimension with monthly granularity', () => {
    const compiled = compile(cubes, {
      measures: ['Orders.count'],
      timeDimensions: [{ dimension: 'Orders.ordered_at', granularity: 'month' }],
      order: { 'Orders.ordered_at': 'asc' },
    })
    const rows = execSql(db, compiled)
    assert.ok(rows.length >= 12)
    assert.ok('Orders.ordered_at' in rows[0]!)
  })

  it('limit and offset', () => {
    const compiled = compile(cubes, {
      measures: ['Orders.count'],
      dimensions: ['Orders.status'],
      limit: 2,
      offset: 1,
    })
    const rows = execSql(db, compiled)
    assert.equal(rows.length, 2)
  })

  it('filter with notSet (NULL country)', () => {
    const compiled = compile(cubes, {
      measures: ['Orders.count'],
      dimensions: ['Customers.country'],
      filters: [{ member: 'Customers.country', operator: 'notSet', values: [] }],
    })
    const rows = execSql(db, compiled)
    assert.equal(rows.length, 1)
    assert.equal(rows[0]['Customers.country'], null)
    assert.equal(Number(rows[0]['Orders.count']), 2)
  })

  it('contains filter via LIKE (SqliteDialect)', () => {
    const compiled = compile(cubes, {
      measures: ['OrderItems.items_sold'],
      dimensions: ['OrderItems.product_name'],
      filters: [{ member: 'OrderItems.product_name', operator: 'contains', values: ['organic'] }],
      order: { 'OrderItems.items_sold': 'desc' },
    })
    const rows = execSql(db, compiled)
    assert.ok(rows.length >= 1)
    assert.match(String(rows[0]!['OrderItems.product_name']), /organic/i)
  })

  it('logical AND/OR filter', () => {
    const compiled = compile(cubes, {
      measures: ['Orders.count'],
      dimensions: ['Orders.status'],
      filters: [{
        and: [
          { member: 'Orders.status', operator: 'equals', values: ['completed'] },
          { member: 'Orders.ordered_at', operator: 'afterDate', values: ['2024-01-01'] },
        ],
      }],
    })
    const rows = execSql(db, compiled)
    const count = Number(rows[0]!['Orders.count'])
    assert.equal(count, 6)
  })

  it('items_sold per product_name', () => {
    const compiled = compile(cubes, {
      measures: ['OrderItems.items_sold'],
      dimensions: ['OrderItems.product_name'],
      order: { 'OrderItems.items_sold': 'desc' },
      limit: 5,
    })
    const rows = execSql(db, compiled)
    assert.equal(rows.length, 5)
    assert.ok(Number(rows[0]!['OrderItems.items_sold']) >= Number(rows[4]!['OrderItems.items_sold']))
  })

  it('Cube WHERE (deleted customers excluded)', () => {
    const compiled = compile(cubes, {
      measures: ['Customers.count'],
      dimensions: ['Customers.country'],
    })
    const rows = execSql(db, compiled)
    const total = rows.reduce((s, r) => s + Number(r['Customers.count']), 0)
    // 6 active customers (Frank and Hans are deleted)
    assert.equal(total, 6)
  })

  it('supplier tier analysis', () => {
    const compiled = compile(cubes, {
      measures: ['Suppliers.count'],
      dimensions: ['Suppliers.tier'],
      order: { 'Suppliers.count': 'desc' },
    })
    const rows = execSql(db, compiled)
    assert.ok(rows.length >= 3)
    const premium = rows.find(r => r['Suppliers.tier'] === 'premium')
    assert.ok(premium)
    assert.equal(Number(premium['Suppliers.count']), 2)
  })

  it('calculated measure throws for SqliteDialect (references percentile)', () => {
    // count_pct uses SUM OVER which *should* work in SQLite,
    // but the calculated measure tests are better done in unit tests.
    // Here we just verify basic calculated measure usage.
    const cubesWithCalc = makeSqliteCubes()
    const ordersCube = cubesWithCalc.get('Orders')!
    ordersCube.measures['count_pct'] = {
      type: 'calculated',
      calculatedSql: '({Orders.count} * 100.0) / SUM({Orders.count}) OVER ()',
    }
    const compiled = compile(cubesWithCalc, {
      measures: ['Orders.count', 'Orders.count_pct'],
    })
    const rows = execSql(db, compiled)
    assert.equal(rows.length, 1)
    assert.equal(Number(rows[0]['Orders.count']), 14)
    assert.equal(Number(rows[0]['Orders.count_pct']), 100)
  })
})
