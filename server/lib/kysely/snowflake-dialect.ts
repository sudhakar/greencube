import {
  DialectAdapterBase,
  type CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type Driver,
  type Kysely,
  type QueryCompiler,
  type QueryResult,
  PostgresQueryCompiler,
} from 'kysely'
import * as snowflake from 'snowflake-sdk'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface SnowflakeDialectConfig {
  connection: snowflake.ConnectionOptions
  /** Max connections in pool. Default 10. */
  max?: number
}

// ---------------------------------------------------------------------------
// Dialect — entry point
// ---------------------------------------------------------------------------

export class SnowflakeDialect implements Dialect {
  readonly #config: SnowflakeDialectConfig

  constructor(config: SnowflakeDialectConfig) {
    this.#config = config
  }

  createAdapter() {
    return new SnowflakeAdapter()
  }

  createDriver(): Driver {
    return new SnowflakeDriver(this.#config)
  }

  createQueryCompiler(): QueryCompiler {
    return new PostgresQueryCompiler()
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new SnowflakeIntrospector(db)
  }
}

// ---------------------------------------------------------------------------
// Adapter — dialect capability flags
// ---------------------------------------------------------------------------

class SnowflakeAdapter extends DialectAdapterBase {
  get supportsTransactionalDdl() {
    return true
  }
  get supportsReturning() {
    return false
  }
  get supportsCreateIfNotExists() {
    return true
  }
  get supportsOutput() {
    return false
  }
  async acquireMigrationLock() {}
  async releaseMigrationLock() {}
}

// ---------------------------------------------------------------------------
// Driver — connection pool
// ---------------------------------------------------------------------------

class SnowflakeDriver implements Driver {
  readonly config: SnowflakeDialectConfig
  pool: ReturnType<typeof snowflake.createPool> | null = null
  #conns = new Map<DatabaseConnection, SnowflakeConnection>()

  constructor(config: SnowflakeDialectConfig) {
    this.config = config
  }

  async init(): Promise<void> {
    this.pool = snowflake.createPool(this.config.connection, {
      max: this.config.max ?? 10,
      min: 1,
    })
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    const sdkConn = await this.pool!.acquire()
    const conn = new SnowflakeConnection(sdkConn)
    this.#conns.set(conn, conn)
    return conn
  }

  async releaseConnection(conn: DatabaseConnection): Promise<void> {
    const wrapped = this.#conns.get(conn)
    if (wrapped) {
      this.#conns.delete(conn)
      await this.pool!.release(wrapped.sdkConn)
    }
  }

  async destroy(): Promise<void> {
    if (this.pool) {
      await this.pool.drain()
      this.pool.clear()
      this.pool = null
    }
  }

  async beginTransaction(conn: DatabaseConnection): Promise<void> {
    await this.#conns.get(conn)!.runRaw('BEGIN')
  }

  async commitTransaction(conn: DatabaseConnection): Promise<void> {
    await this.#conns.get(conn)!.runRaw('COMMIT')
  }

  async rollbackTransaction(conn: DatabaseConnection): Promise<void> {
    await this.#conns.get(conn)!.runRaw('ROLLBACK')
  }
}

// ---------------------------------------------------------------------------
// Connection — wraps a single snowflake-sdk Connection
// ---------------------------------------------------------------------------

class SnowflakeConnection implements DatabaseConnection {
  readonly sdkConn: snowflake.Connection

  constructor(conn: snowflake.Connection) {
    this.sdkConn = conn
  }

  async runRaw(sqlText: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.sdkConn.execute({ sqlText, complete: (err) => (err ? reject(err) : resolve()) })
    })
  }

  async *streamQuery<R>(compiled: CompiledQuery, chunkSize: number): AsyncIterableIterator<QueryResult<R>> {
    const binds = compiled.parameters as snowflake.Binds

    const readable = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      this.sdkConn.execute({
        sqlText: compiled.sql,
        binds,
        streamResult: true,
        complete(err, stmt) {
          if (err) return reject(err)
          resolve((stmt as snowflake.RowStatement).streamRows())
        },
      })
    })

    let chunk: R[] = []
    for await (const row of readable) {
      chunk.push(row as unknown as R)
      if (chunk.length >= chunkSize) {
        yield { rows: chunk }
        chunk = []
      }
    }
    if (chunk.length > 0) {
      yield { rows: chunk }
    }
  }

  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const rows: R[] = []
    for await (const result of this.streamQuery<R>(compiled, 10_000)) {
      rows.push(...result.rows)
    }
    return { rows }
  }
}

// ---------------------------------------------------------------------------
// Introspector — INFORMATION_SCHEMA queries
// ---------------------------------------------------------------------------

interface RawColumn {
  COLUMN_NAME: string
  COLUMN_DEFAULT: string | null
  TABLE_NAME: string
  TABLE_SCHEMA: string
  TABLE_TYPE: string
  IS_NULLABLE: 'YES' | 'NO'
  DATA_TYPE: string
  IS_IDENTITY: 'YES' | 'NO'
}

class SnowflakeIntrospector implements DatabaseIntrospector {
  readonly #db: Kysely<any>

  constructor(db: Kysely<any>) {
    this.#db = db
  }

  async getSchemas(): Promise<{ name: string }[]> {
    const rows = await this.#db
      .selectFrom('INFORMATION_SCHEMA.SCHEMATA')
      .select('SCHEMA_NAME')
      .$castTo<{ SCHEMA_NAME: string }>()
      .execute()

    return rows.map((r) => ({ name: r.SCHEMA_NAME }))
  }

  async getTables(options = { withInternalKyselyTables: false }): Promise<import('kysely').TableMetadata[]> {
    let query = this.#db
      .selectFrom('INFORMATION_SCHEMA.COLUMNS as c')
      .innerJoin('INFORMATION_SCHEMA.TABLES as t', (b) =>
        b
          .onRef('c.TABLE_CATALOG', '=', 't.TABLE_CATALOG')
          .onRef('c.TABLE_SCHEMA', '=', 't.TABLE_SCHEMA')
          .onRef('c.TABLE_NAME', '=', 't.TABLE_NAME'),
      )
      .select([
        'c.COLUMN_NAME',
        'c.COLUMN_DEFAULT',
        'c.TABLE_NAME',
        'c.TABLE_SCHEMA',
        't.TABLE_TYPE',
        'c.IS_NULLABLE',
        'c.DATA_TYPE',
        'c.IS_IDENTITY',
      ])
      .where('c.TABLE_SCHEMA', '!=', 'INFORMATION_SCHEMA')
      .orderBy('c.TABLE_NAME')
      .orderBy('c.ORDINAL_POSITION')
      .$castTo<RawColumn>()

    if (!options.withInternalKyselyTables) {
      query = query
        .where('c.TABLE_NAME', '!=', 'kysely_migrations')
        .where('c.TABLE_NAME', '!=', 'kysely_migrations_lock')
    }

    const rawColumns = await query.execute()
    return this.#parse(rawColumns)
  }

  #parse(columns: RawColumn[]): import('kysely').TableMetadata[] {
    const map = new Map<string, import('kysely').TableMetadata>()

    for (const col of columns) {
      const key = `${col.TABLE_SCHEMA}.${col.TABLE_NAME}`

      if (!map.has(key)) {
        map.set(key, {
          name: col.TABLE_NAME,
          isView: col.TABLE_TYPE === 'VIEW',
          isForeign: false,
          schema: col.TABLE_SCHEMA,
          columns: [],
        })
      }

      map.get(key)!.columns.push({
        name: col.COLUMN_NAME,
        dataType: col.DATA_TYPE,
        isNullable: col.IS_NULLABLE === 'YES',
        isAutoIncrementing: col.IS_IDENTITY === 'YES',
        hasDefaultValue: col.COLUMN_DEFAULT !== null,
      })
    }

    return Array.from(map.values())
  }
}
