/**
 * GreenCube Server — SQLite-based using Kysely + better-sqlite3.
 *
 * Seeds an in-memory SQLite database with HR analytics data and starts
 * the Hono API server with the GreenCube query engine.
 */

import { serve } from '@hono/node-server'
import Database from 'better-sqlite3'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { decode } from 'hono/jwt'
import { Kysely, SqliteDialect } from 'kysely'
import { createCubeApp } from '../lib/api.ts'
import { SqliteDialect as CubeSqliteDialect } from '../lib/dialects/SqliteDialect.ts'
import type { DataSource } from '../lib/GreenCube.ts'
import { createTryApp } from '../lib/try.ts'
import { allCubes, SAMPLES } from './cube-schema.ts'
import { seed } from './seeds.ts'

const PORT = parseInt(process.env.PORT ?? '3003', 10)

const sqliteDb = new Database(':memory:')
seed(sqliteDb)

const kysely = new Kysely({
  dialect: new SqliteDialect({ database: sqliteDb }),
})

const ds: DataSource = {
  dialect: new CubeSqliteDialect(),
  async run(sql: string, params?: unknown[]) {
    const stmt = sqliteDb.prepare(sql)
    const rows = stmt.all(params ?? []) as Record<string, unknown>[]
    return { data: rows }
  },
}

const cubes = new Map(allCubes.map(c => [c.name, c]))

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

app.route('/cube', createCubeApp(cubes, ds, SAMPLES))
app.route('/cube', createTryApp(cubes))

serve({ fetch: app.fetch, port: PORT })
console.log(`GreenCube SQLite demo running at http://localhost:${PORT}`)
