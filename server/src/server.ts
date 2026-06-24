/**
 * GreenCube Server — SQLite-based using SqliteDialect.
 *
 * Seeds an in-memory SQLite database with e-commerce data and starts
 * the Hono API server with the GreenCube query engine.
 *
 * Usage:
 *   npx tsx src/greenfield/demo/server.ts
 */

import { DatabaseSync } from 'node:sqlite'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { decode } from 'hono/jwt'
import * as cubeDefs from './cubes.ts'
import { SAMPLES } from './cubes.ts'
import { createCubeApp } from './lib/api.ts'
import { SqliteDialect } from './lib/dialects/SqliteDialect.ts'
import type { Cube } from './lib/GreenCube.ts'
import { createTryApp } from './lib/try.ts'
import { seed } from './seeds.ts'

const PORT = parseInt(process.env.PORT ?? '3003', 10)

const db = new DatabaseSync(':memory:')
seed(db)

const connection = {
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
}

const cubes = new Map<string, Cube>()
for (const c of Object.values(cubeDefs) as Cube[]) {
  if (c && typeof c === 'object' && 'name' in c && 'sql' in c) {
    cubes.set(c.name, c)
  }
}

const dialect = new SqliteDialect()

const app = new Hono()

app.use('*', cors())

// Decode JWT from Authorization header into c.var.user (no verification — trusted issuer)
app.use('/cube/*', async (c, next) => {
  const auth = c.req.header('Authorization')
  if (auth?.startsWith('Bearer ')) {
    try {
      const { payload } = decode(auth.slice(7))
      ;(c as any).set('user', payload)
    } catch (e) {
      // Malformed token — treat as anonymous
    }
  }
  await next()
})

app.get('/', (c) => {
  return c.json({
    name: 'GreenCube Server (SQLite Demo)',
    status: 'ok',
    cubes: [...cubes.keys()],
    dialect: 'sqlite',
  })
})

app.route('/cube', createCubeApp(cubes, connection as any, dialect, SAMPLES))
app.route('/cube', createTryApp(cubes))

serve({ fetch: app.fetch, port: PORT })
console.log(`GreenCube SQLite demo running at http://localhost:${PORT}`)
