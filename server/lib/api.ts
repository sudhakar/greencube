/**
 * GreenCube API — Hono API server for the GreenCube engine.
 *
 * Exports `createCubeApp(cubes, executor)` returning a Hono instance.
 * Mount under `/cube`. Read-only — no mutations.
 */

import { Hono } from 'hono'
import type { Cube, DataSource, Query } from './GreenCube.ts'
import { CubeQueryCompiler } from './GreenCube.ts'
import { formatExplain, formatMeta } from './utils.ts'

// =============================================================================
// createCubeApp
// =============================================================================

export function createCubeApp(
  cubes: ReadonlyMap<string, Cube>,
  ds: DataSource,
  samples?: { name: string; json: Record<string, unknown> }[],
): Hono {
  const app = new Hono()
  const compiler = new CubeQueryCompiler(cubes, ds.dialect)

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
      const { data } = await ds.run(compiled.sql, compiled.params)
      return c.json({ data })
    } catch (err: any) {
      return c.json({ error: err.message ?? String(err) }, 400)
    }
  })

  app.post('/explain', async (c) => {
    try {
      const body = await c.req.json()
      const query: Query = body.query ?? body
      const compiled = compiler.compile(query)
      const { data } = await ds.run(`EXPLAIN ${compiled.sql}`)
      const text = formatExplain(data)
      return c.json({ data: { text, sql: compiled.sql, params: compiled.params } })
    } catch (err: any) {
      return c.json({ error: err.message ?? String(err) }, 400)
    }
  })

  return app
}
