import assert from 'node:assert/strict'
import type { SQLInputValue } from 'node:sqlite'
import { DatabaseSync } from 'node:sqlite'
import { before, describe, it } from 'node:test'
import { SqliteDialect } from '../dialects/SqliteDialect.ts'
import type { Cube } from '../GreenCube.ts'
import { CubeQueryCompiler } from '../GreenCube.ts'
import { MutationExecutor } from '../mutate.ts'
import * as cubeDefs from './cubes.ts'
import { seed } from './seeds.ts'

let db: DatabaseSync
let executor: MutationExecutor
let cubes: Map<string, Cube>

function makeCubes() {
  const orig = Object.values(cubeDefs).filter(v => typeof v !== 'function')
  const map = new Map<string, Cube>()
  for (const c of orig) map.set(c.name, { ...c, measures: { ...c.measures } })
  return map
}

function query(compiled: { sql: string; params: unknown[] }): Record<string, unknown>[] {
  const stmt = db.prepare(compiled.sql)
  return stmt.all(...(compiled.params as SQLInputValue[])) as Record<string, unknown>[]
}

before(() => {
  db = new DatabaseSync(':memory:')
  seed(db)
  cubes = makeCubes()
  executor = new MutationExecutor(cubes, {
    execute(opts: { sqlText: string; binds?: unknown[]; complete: Function }) {
      setTimeout(() => {
        try {
          const stmt = db.prepare(opts.sqlText)
          const rows = stmt.all(...(opts.binds as any ?? []))
          opts.complete(null, null, rows)
        } catch (err) {
          opts.complete(err, null, null)
        }
      }, 0)
    },
  } as any, new SqliteDialect())
})

describe('MutationExecutor', () => {

  describe('create', () => {
    it('inserts a row and returns it', async () => {
      const result = await executor.execute({
        cube: 'Customers',
        operation: 'create',
        values: { name: 'New Person', country: 'IN' },
      })
      assert.equal(result.data.length, 1)
      assert.equal(result.data[0].name, 'New Person')
      assert.equal(result.data[0].country, 'IN')

      // Verify it persists (8 seeded, 2 deleted by cube WHERE → 6 active, +1 = 7)
      const compiler = new CubeQueryCompiler(cubes, new SqliteDialect())
      const compiled = compiler.compile({ measures: ['Customers.count'] })
      const rows = query(compiled)
      assert.equal(Number(rows[0]['Customers.count']), 7)
    })

    it('accepts returning clause', async () => {
      const result = await executor.execute({
        cube: 'Customers',
        operation: 'create',
        values: { name: 'Returning Test', country: 'UK' },
        returning: ['id', 'name'],
      })
      assert.equal(result.data.length, 1)
      assert.ok(result.data[0].id !== undefined)
      assert.equal(result.data[0].name, 'Returning Test')
      assert.equal(result.data[0].country, undefined)
    })

    it('rejects empty values', async () => {
      await assert.rejects(
        () => executor.execute({ cube: 'Customers', operation: 'create', values: {} }),
        { message: /requires at least one value/ },
      )
    })

    it('rejects unknown field', async () => {
      await assert.rejects(
        () => executor.execute({ cube: 'Customers', operation: 'create', values: { nonexistent: 'x' } }),
        { message: /Unknown field/ },
      )
    })

    it('rejects measure field', async () => {
      await assert.rejects(
        () => executor.execute({ cube: 'Customers', operation: 'create', values: { count: 10 } }),
        { message: /Cannot write computed measure/ },
      )
    })

    it('coerces boolean true to integer 1', async () => {
      const result = await executor.execute({
        cube: 'Customers',
        operation: 'create',
        values: { name: 'Bool True', country: 'NZ', isActive: true },
      })
      assert.equal(result.data.length, 1)
      assert.equal(result.data[0].active, 1)
    })

    it('coerces boolean false to integer 0', async () => {
      const result = await executor.execute({
        cube: 'Customers',
        operation: 'create',
        values: { name: 'Bool False', country: 'AU', isActive: false },
      })
      assert.equal(result.data.length, 1)
      assert.equal(result.data[0].active, 0)
    })
  })

  describe('update', () => {
    it('updates a row and returns it', async () => {
      const result = await executor.execute({
        cube: 'Customers',
        operation: 'update',
        values: { country: 'CA' },
        filters: [{ member: 'name', operator: 'equals', values: ['Alice'] }],
      })
      assert.equal(result.data.length, 1)
      assert.equal(result.data[0].country, 'CA')

      // Verify persistence
      const compiler = new CubeQueryCompiler(cubes, new SqliteDialect())
      const compiled = compiler.compile({
        measures: ['Customers.count'],
        filters: [{ member: 'Customers.country', operator: 'equals', values: ['CA'] }],
      })
      const rows = query(compiled)
      assert.equal(Number(rows[0]['Customers.count']), 1)
    })

    it('updates multiple matching rows', async () => {
      // Reset Alice back to US
      await executor.execute({
        cube: 'Customers',
        operation: 'update',
        values: { country: 'US' },
        filters: [{ member: 'name', operator: 'equals', values: ['Alice'] }],
      })
      // Now update both US customers
      const result = await executor.execute({
        cube: 'Customers',
        operation: 'update',
        values: { country: 'XX' },
        filters: [{ member: 'country', operator: 'equals', values: ['US'] }],
      })
      assert.ok(result.data.length >= 2)
    })

    it('rejects without filter', async () => {
      await assert.rejects(
        () => executor.execute({ cube: 'Customers', operation: 'update', values: { name: 'x' } }),
        { message: /requires at least one filter/ },
      )
    })
  })

  describe('delete', () => {
    it('deletes a row and returns it', async () => {
      const result = await executor.execute({
        cube: 'Customers',
        operation: 'delete',
        filters: [{ member: 'name', operator: 'equals', values: ['Grace'] }],
      })
      assert.equal(result.data.length, 1)
      assert.equal(result.data[0].name, 'Grace')

      // Verify deletion
      const compiler = new CubeQueryCompiler(cubes, new SqliteDialect())
      const compiled = compiler.compile({
        measures: ['Customers.count'],
        filters: [{ member: 'Customers.name', operator: 'equals', values: ['Grace'] }],
      })
      const rows = query(compiled)
      assert.equal(Number(rows[0]['Customers.count']), 0)
    })

    it('rejects without filter', async () => {
      await assert.rejects(
        () => executor.execute({ cube: 'Customers', operation: 'delete' }),
        { message: /requires at least one filter/ },
      )
    })
  })

  describe('validation', () => {
    it('rejects unknown cube', async () => {
      await assert.rejects(
        () => executor.execute({ cube: 'NonExistent', operation: 'create', values: { name: 'x' } }),
        { message: /not found/ },
      )
    })

    it('rejects filter on unknown field', async () => {
      await assert.rejects(
        () => executor.execute({
          cube: 'Customers',
          operation: 'update',
          values: { name: 'x' },
          filters: [{ member: 'nonexistent', operator: 'equals', values: ['x'] }],
        }),
        { message: /Filter field.*not found/ },
      )
    })
  })

})
