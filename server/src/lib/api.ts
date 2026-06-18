/**
 * GreenCube API — Hono API server for the GreenCube engine.
 *
 * Exports `createCubeApp(cubes, connection)` returning a Hono instance.
 * Mount under `/cube`.
 */

import { Hono } from 'hono'
import type { Connection } from 'snowflake-sdk'
import type { Dialect } from './dialects/Dialect.ts'
import type { Cube, Query } from './GreenCube.ts'
import { CubeQueryCompiler } from './GreenCube.ts'
import { exec, formatExplain, formatMeta } from './utils.ts'

// =============================================================================
// createCubeApp
// =============================================================================

export function createCubeApp(
  cubes: ReadonlyMap<string, Cube>,
  connection: Connection | null,
  dialect?: Dialect,
  samples?: { name: string; json: Record<string, unknown> }[],
): Hono {
  const app = new Hono()
  const compiler = new CubeQueryCompiler(cubes, dialect)

  app.get('/meta', (c) => {
    return c.json(formatMeta(cubes, [
      { method: 'GET', path: '/meta', description: 'Cube metadata, name, and route listing' },
      { method: 'POST', path: '/query', description: 'Execute a query and return results' },
      { method: 'POST', path: '/explain', description: 'Get SQL, params, and formatted execution plan' },
      { method: 'GET', path: '/try', description: 'Interactive query playground' },
    ], samples))
  })

  app.post('/query', async (c) => {
    try {
      const body = await c.req.json()
      const query: Query = body.query ?? body
      const compiled = compiler.compile(query)
      const rows = await exec(connection, compiled.sql, compiled.params as any)
      return c.json({ data: rows })
    } catch (err: any) {
      return c.json({ error: err.message ?? String(err) }, 400)
    }
  })

  app.post('/explain', async (c) => {
    try {
      const body = await c.req.json()
      const query: Query = body.query ?? body
      const compiled = compiler.compile(query)
      const rows = await exec(connection, `EXPLAIN ${compiled.sql}`, [])
      const text = formatExplain(rows)
      return c.json({ data: { text, sql: compiled.sql, params: compiled.params } })
    } catch (err: any) {
      return c.json({ error: err.message ?? String(err) }, 400)
    }
  })

  return app
}
