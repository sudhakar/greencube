# GreenCube Server

Hono API server that exposes the GreenCube query engine. Reads cube definitions, compiles them to SQL, and executes against any database via a `DataSource` adapter.

## Project structure

```
├── package.json
├── tsconfig.json
├── demo/
│   ├── server.ts        ← entry point (npm run dev)
│   ├── schema.ts        ← cube definitions (defineCube)
│   └── seeds.ts         ← SQLite seed data
└── lib/
    ├── api.ts            ← createCubeApp (Hono routes)
    ├── GreenCube.ts      ← compiler, types (Cube, DataSource, Query)
    ├── try.ts            ← interactive playground
    ├── utils.ts          ← formatMeta, formatExplain, levenshtein
    ├── dialects/
    │   ├── Dialect.ts         ← abstract SQL generation
    │   ├── SnowDialect.ts     ← Snowflake SQL
    │   └── SqliteDialect.ts   ← SQLite SQL
    └── kysely/
        └── snowflake-dialect.ts  ← Kysely adapter for Snowflake
```

## Getting started

```bash
npm run dev    # SQLite demo on http://localhost:3003
```

## DataSource

The cube layer doesn't own a database driver. It takes a `DataSource` — any object that can run SQL:

```ts
interface DataSource {
  dialect: Dialect                          // SQL generation (Snowflake vs SQLite)
  run(sql: string, params?: unknown[]): Promise<{
    data: Record<string, unknown>[]
    rowsAffected?: number
  }>
}
```

The compiler uses `dialect` to generate SQL. `ds.run()` executes it. These are separate concerns bundled into one value so they can't be mismatched.

### SQLite

Use Kysely + `better-sqlite3`:

```ts
import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import { SqliteDialect as CubeSqliteDialect } from './lib/dialects/SqliteDialect.ts'
import type { DataSource } from './lib/GreenCube.ts'

const sqliteDb = new Database(':memory:')
const kysely = new Kysely({ dialect: new SqliteDialect({ database: sqliteDb }) })

const ds: DataSource = {
  dialect: new CubeSqliteDialect(),
  async run(sql, params) {
    const { rows } = await kysely.executeQuery({ sql, parameters: params ?? [] })
    return { data: rows as Record<string, unknown>[] }
  },
}
```

Kysely handles parameter binding. `ds.dialect` handles SQL generation. These are separate concerns bundled into one value so they can't be mismatched.

### Snowflake

Use the bundled Kysely dialect for connection pooling and streaming:

```ts
import { Kysely } from 'kysely'
import { SnowflakeDialect } from './lib/kysely/snowflake-dialect.ts'
import type { DataSource } from './lib/GreenCube.ts'

const dialect = new SnowflakeDialect({
  connection: {
    account: 'your-account',
    username: 'your-user',
    password: 'your-pass',
    database: 'your-db',
    schema: 'your-schema',
    warehouse: 'your-warehouse',
  },
})

const kysely = new Kysely({ dialect })

const ds: DataSource = {
  dialect: dialect,  // GreenCube Dialect (not Kysely Dialect)
  async run(sql, params) {
    // Kysely's raw SQL execution
    const { rows } = await kysely.executeQuery({ sql, parameters: params ?? [] })
    return { data: rows as Record<string, unknown>[] }
  },
}
```

> **Note:** GreenCube's `Dialect` (SQL generation) and Kysely's `Dialect` (driver abstraction) are different types with the same name. The Snowflake dialect at `lib/kysely/snowflake-dialect.ts` implements Kysely's `Dialect`. The cube compiler uses GreenCube's `Dialect` from `lib/dialects/`.

## Starting the server

```ts
import { createCubeApp } from './lib/api.ts'
import { createTryApp } from './lib/try.ts'

const app = new Hono()
app.route('/cube', createCubeApp(cubes, ds, SAMPLES))
app.route('/cube', createTryApp(cubes))

serve({ fetch: app.fetch, port: 3003 })
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cube/meta` | Cube metadata, fields, types |
| POST | `/cube/query` | Execute a cube query |
| POST | `/cube/explain` | SQL + execution plan |
| GET | `/cube/try` | Interactive playground |

## Co-existing Kysely schema and cube schema

Kysely and cubes define the same tables at different abstraction levels. They serve different purposes and coexist.

### Kysely schema — real columns, TypeScript types

One interface per table. Matches actual DB columns. Used for type-safe direct queries.

```ts
interface Database {
  employees: {
    id: number
    name: string
    salary: number
    department_id: number
    birth_date: string
    active: boolean
  }
  departments: {
    id: number
    name: string
    budget: number
  }
}
```

### Cube definition — semantic layer, computed fields, measures

Same table, different abstraction. Adds computed dimensions, measures, joins, RLS, and sample queries.

```ts
const employeesCube = defineCube('Employees', {
  sql: 'analytics.employees e',
  pk: ['id'],
  dimensions: {
    id:           { sql: 'e.id', type: 'number' },
    name:         { sql: 'e.name', type: 'string' },
    salary:       { sql: 'e.salary', type: 'number' },
    // Computed — doesn't exist as a column
    age:          { sql: "DATEDIFF('year', e.birth_date, CURRENT_DATE)", type: 'number' },
  },
  measures: {
    count:      { sql: 'e.id', type: 'countDistinct' },
    avgSalary:  { sql: 'e.salary', type: 'avg' },
  },
  joins: {
    Departments: {
      sql: 'analytics.departments d',
      relationship: 'belongsTo',
      on: 'e.department_id = d.id',
    },
  },
  where: () => 'e.active = TRUE',
})
```

### When to use which

| Need | Use |
|------|-----|
| Aggregations via API (`POST /cube/query`) | Cube |
| Measures like `median`, `p95`, `stddev` | Cube |
| Computed dimensions (`age`, `tenure`) | Cube |
| Row-level security | Cube |
| Multi-cube joins with CTEs | Cube |
| Type-safe `INSERT`, `UPDATE`, `DELETE` | Kysely |
| Type-safe `SELECT` with joins | Kysely |
| Transactions | Kysely |
| Direct Snowflake features (UDFs, geometry) | Kysely raw SQL |

### Both on the same server

```ts
import { Kysely } from 'kysely'
import { SnowflakeDialect } from './lib/kysely/snowflake-dialect.ts'
import { createCubeApp } from './lib/api.ts'

// Kysely for direct DB access
const kysely = new Kysely<Database>({ dialect: snowflakeKyselyDialect })

// DataSource for cube layer
const ds: DataSource = {
  dialect: snowflakeCubeDialect,
  async run(sql, params) {
    const { rows } = await kysely.executeQuery({ sql, parameters: params ?? [] })
    return { data: rows as Record<string, unknown>[] }
  },
}

// Cube API (analytics, aggregations)
app.route('/cube', createCubeApp(cubes, ds))

// Direct API (CRUD, transactions)
app.post('/employees', async (c) => {
  const body = await c.req.json()
  const result = await kysely.insertInto('employees').values(body).executeTakeFirst()
  return c.json(result)
})

app.get('/employees/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const employee = await kysely.selectFrom('employees').where('id', '=', id).executeTakeFirst()
  return c.json(employee)
})

// Transaction
await kysely.transaction().execute(async (trx) => {
  await trx.insertInto('employees').values({ name: 'Bob', salary: 80000 }).execute()
  await trx.updateTable('departments').set({ headcount: 5 }).where('id', '=', 1 }).execute()
})
```
