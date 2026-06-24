import type { Connection } from 'snowflake-sdk'
import type { Dialect } from './dialects/Dialect.ts'
import type { Cube, Filter } from './GreenCube.ts'
import { exec, fieldToColumn } from './utils.ts'

export type MutationOp = 'create' | 'update' | 'delete'

export interface Mutation {
  cube: string
  operation: MutationOp
  values?: Record<string, unknown>
  filters?: Filter[]
  returning?: string[]
}

export type AuthorizeFn = (mutation: Mutation, ctx: { headers?: Record<string, string>; user?: Record<string, unknown> }) => boolean | Promise<boolean>

const DIRECT_COLUMN_RE = /^\w+\.\w+$/

export class MutationExecutor {
  private cubes: ReadonlyMap<string, Cube>
  private connection: Connection | null
  private dialect: Dialect
  private authorize?: AuthorizeFn

  constructor(
    cubes: ReadonlyMap<string, Cube>,
    connection: Connection | null,
    dialect: Dialect,
    authorize?: AuthorizeFn,
  ) {
    this.cubes = cubes
    this.connection = connection
    this.dialect = dialect
    this.authorize = authorize
  }

  async execute(
    mutation: Mutation,
    ctx?: { headers?: Record<string, string>; user?: Record<string, unknown> },
  ): Promise<{ data: Record<string, unknown>[] }> {
    if (this.authorize && ctx) {
      const allowed = await this.authorize(mutation, ctx)
      if (!allowed) {
        const err = new Error('Not authorized') as Error & { status: number }
        err.status = 403
        throw err
      }
    }

    const cube = this.cubes.get(mutation.cube)
    if (!cube) {
      const err = new Error(`Cube "${mutation.cube}" not found`) as Error & { status: number }
      err.status = 400
      throw err
    }

    this.validate(mutation, cube)

    const { sql, params } = this.buildSql(mutation, cube)
    const rows = await exec(this.connection, sql, params as any)
    return { data: rows }
  }

  private validate(mutation: Mutation, cube: Cube): void {
    const raise = (status: number, msg: string): never => {
      const err = new Error(msg) as Error & { status: number }
      err.status = status
      throw err
    }

    if (mutation.operation === 'create') {
      if (!mutation.values || Object.keys(mutation.values).length === 0) {
        raise(400, 'create requires at least one value')
      }
    }

    if ((mutation.operation === 'update' || mutation.operation === 'delete') &&
        (!mutation.filters || mutation.filters.length === 0)) {
      raise(400, `${mutation.operation} requires at least one filter for safety`)
    }

    if (mutation.values) {
      for (const key of Object.keys(mutation.values)) {
        if (cube.measures[key]) {
          raise(400, `Cannot write computed measure "${cube.name}.${key}"`)
        }
        if (!cube.dimensions[key]) {
          raise(400, `Unknown field "${key}" on cube "${cube.name}"`)
        }
        const dim = cube.dimensions[key]!
        const sqlStr = typeof dim.sql === 'function' ? '' : dim.sql
        if (!DIRECT_COLUMN_RE.test(sqlStr)) {
          raise(400, `Cannot write computed dimension "${cube.name}.${key}"`)
        }
      }
    }

    if (mutation.filters) {
      for (const f of mutation.filters) {
        if (!cube.dimensions[f.member]) {
          raise(400, `Filter field "${f.member}" not found on cube "${cube.name}"`)
        }
      }
    }
  }

  private buildSql(mutation: Mutation, cube: Cube): { sql: string; params: unknown[] } {
    const table = cube.sql.split(/\s+/)[0]!

    switch (mutation.operation) {
      case 'create': return this.buildInsert(mutation, cube, table)
      case 'update': return this.buildUpdate(mutation, cube, table)
      case 'delete': return this.buildDelete(mutation, cube, table)
    }
  }

  private buildInsert(mutation: Mutation, cube: Cube, table: string): { sql: string; params: unknown[] } {
    const entries = Object.entries(mutation.values ?? {})
    const cols = entries.map(([key]) => fieldToColumn(typeof cube.dimensions[key]!.sql === 'function' ? key : cube.dimensions[key]!.sql as string))
    const placeholders = entries.map(() => '?')
    const params = entries.map(([, v]) => v)
    const returning = mutation.returning?.join(', ') ?? '*'
    return {
      sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING ${returning}`,
      params,
    }
  }

  private buildUpdate(mutation: Mutation, cube: Cube, table: string): { sql: string; params: unknown[] } {
    const entries = Object.entries(mutation.values ?? {})
    const setClauses = entries.map(([key]) => {
      const col = fieldToColumn(typeof cube.dimensions[key]!.sql === 'function' ? key : cube.dimensions[key]!.sql as string)
      return `${col} = ?`
    })
    const params: unknown[] = entries.map(([, v]) => v)

    let whereClause = ''
    if (mutation.filters && mutation.filters.length > 0) {
      const w = this.buildWhere(mutation.filters, cube)
      whereClause = ` WHERE ${w.sql}`
      params.push(...w.params)
    }

    const returning = mutation.returning?.join(', ') ?? '*'
    return {
      sql: `UPDATE ${table} SET ${setClauses.join(', ')}${whereClause} RETURNING ${returning}`,
      params,
    }
  }

  private buildDelete(mutation: Mutation, cube: Cube, table: string): { sql: string; params: unknown[] } {
    const params: unknown[] = []

    let whereClause = ''
    if (mutation.filters && mutation.filters.length > 0) {
      const w = this.buildWhere(mutation.filters, cube)
      whereClause = ` WHERE ${w.sql}`
      params.push(...w.params)
    }

    const returning = mutation.returning?.join(', ') ?? '*'
    return {
      sql: `DELETE FROM ${table}${whereClause} RETURNING ${returning}`,
      params,
    }
  }

  private buildWhere(filters: Filter[], cube: Cube): { sql: string; params: unknown[] } {
    const conditions: string[] = []
    const params: unknown[] = []

    for (const f of filters) {
      const col = fieldToColumn(typeof cube.dimensions[f.member]!.sql === 'function' ? f.member : cube.dimensions[f.member]!.sql as string)

      switch (f.operator) {
        case 'equals':
          if (f.values.length === 1) {
            conditions.push(`${col} = ?`)
            params.push(f.values[0])
          } else {
            conditions.push(`${col} IN (${f.values.map(() => '?').join(', ')})`)
            params.push(...f.values)
          }
          break
        case 'notEquals':
          if (f.values.length === 1) {
            conditions.push(`${col} != ?`)
            params.push(f.values[0])
          } else {
            conditions.push(`${col} NOT IN (${f.values.map(() => '?').join(', ')})`)
            params.push(...f.values)
          }
          break
        case 'gt':
          conditions.push(`${col} > ?`); params.push(f.values[0]); break
        case 'gte':
          conditions.push(`${col} >= ?`); params.push(f.values[0]); break
        case 'lt':
          conditions.push(`${col} < ?`); params.push(f.values[0]); break
        case 'lte':
          conditions.push(`${col} <= ?`); params.push(f.values[0]); break
        case 'set':
          conditions.push(`${col} IS NOT NULL`); break
        case 'notSet':
          conditions.push(`${col} IS NULL`); break
        default:
          throw new Error(`Unsupported filter operator in mutation: "${f.operator}"`)
      }
    }

    return { sql: conditions.join(' AND '), params }
  }
}
