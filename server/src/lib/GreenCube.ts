import type { Dialect } from './dialects/Dialect.ts'
import { SnowflakeDialect } from './dialects/SnowDialect.ts'
import { levenshtein } from './utils.ts'

export class SqlExpr {
  readonly text: string
  readonly params: readonly unknown[]

  constructor(text: string, params: readonly unknown[] = []) {
    this.text = text
    this.params = params
  }
}

export function isSqlExpr(v: unknown): v is SqlExpr {
  return v instanceof SqlExpr
}

/**
 * Tagged-template SQL builder.
 * SqlExpr values → their text is inlined, params merged.
 * Other values → ? placeholder, value pushed to params.
 */
export function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): SqlExpr {
  const params: unknown[] = []
  let text = ''
  for (let i = 0; i < strings.length; i++) {
    text += strings[i]
    if (i < values.length) {
      const v = values[i]
      if (v instanceof SqlExpr) {
        text += v.text
        params.push(...v.params)
      } else {
        params.push(v)
        text += '?'
      }
    }
  }
  return new SqlExpr(text, params)
}

/** Wrap a raw SQL string so it is inlined literally (never parameterised). */
export function raw(text: string): SqlExpr {
  return new SqlExpr(text)
}

/** Double-quoted identifier. */
export function ident(name: string): SqlExpr {
  return raw(`"${name.replace(/"/g, '""')}"`)
}


export type MeasureType =
  | 'count'
  | 'countDistinct'
  | 'countDistinctApprox'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'number'
  | 'stddev'
  | 'stddevSamp'
  | 'variance'
  | 'varianceSamp'
  | 'percentile'
  | 'median'
  | 'p95'
  | 'p99'
  | 'lag'
  | 'lead'
  | 'rank'
  | 'denseRank'
  | 'rowNumber'
  | 'ntile'
  | 'firstValue'
  | 'lastValue'
  | 'movingAvg'
  | 'movingSum'
  | 'calculated'

export type DimensionType = 'string' | 'number' | 'boolean' | 'time'

export type Relationship = 'belongsTo' | 'hasMany' | 'hasOne' | 'belongsToMany'

export interface Measure {
  sql?: string | ((ctx: QueryContext) => string)
  type: MeasureType
  title?: string
  filters?: Array<(ctx: QueryContext) => string>
  calculatedSql?: string
  windowConfig?: {
    partitionBy?: string[]
    orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>
    offset?: number
    defaultValue?: unknown
    nTile?: number
    frame?: {
      type: 'rows' | 'range'
      start: number | 'unbounded'
      end: number | 'current' | 'unbounded'
    }
  }
  statisticalConfig?: {
    percentile?: number
    useSample?: boolean
  }
}

export interface Dimension {
  sql: string | ((ctx: QueryContext) => string)
  type: DimensionType
  title?: string
}

export interface CubeJoin {
  targetCube: string | (() => Cube)
  keys: { source: string; target: string }
  relationship: Relationship
  joinType?: 'inner' | 'left' | 'right' | 'full'
}

export interface Cube {
  name: string
  sql: string
  pk?: string[]
  where?: string | ((ctx: QueryContext) => string)
  dimensions: Record<string, Dimension>
  measures: Record<string, Measure>
  joins?: Record<string, CubeJoin>
  sampleQueries?: string[]
}

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'inDateRange'
  | 'notInDateRange'
  | 'set'
  | 'notSet'
  | 'beforeDate'
  | 'afterDate'

export interface Filter {
  member: string
  operator: FilterOperator
  values: unknown[]
}

export interface LogicalFilter {
  and?: Array<Filter | LogicalFilter>
  or?: Array<Filter | LogicalFilter>
}

export interface TimeDimension {
  dimension: string
  granularity: 'day' | 'week' | 'month' | 'quarter' | 'year'
}

export interface Query {
  measures: string[]
  dimensions?: string[]
  timeDimensions?: TimeDimension[]
  filters?: Array<Filter | LogicalFilter>
  order?: Record<string, 'asc' | 'desc'>
  limit?: number
  offset?: number
  ungrouped?: boolean
}

export interface QueryContext {
  securityContext?: Record<string, unknown>
  ungrouped?: boolean
}

export interface QueryResult {
  sql: string
  params: unknown[]
  data: Record<string, unknown>[]
}

export interface CompiledQuery {
  sql: string
  params: unknown[]
}

export interface ValidationError {
  type: 'cube_not_found' | 'measure_not_found' | 'dimension_not_found' | 'time_dimension_not_found' | 'invalid_filter'
  message: string
  field?: string
  suggestion?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}


interface JoinPlanEntry {
  cube: Cube
  joinType: 'inner' | 'left' | 'right' | 'full'
  condition: string
  isMany: boolean
  keys: { source: string; target: string }
}

interface CTEPlanEntry {
  cube: Cube
  cteAlias: string
  joinKeySource: string
  joinKeyTarget: string
  measures: string[]
  dimensionFields: string[]
  where?: string
}

interface Selection {
  alias: string
  expr: SqlExpr
}


export function defineCube<const T extends string, const D extends Omit<Cube, 'name'>>(
  name: T,
  definition: D,
): D & { name: T } {
  return { name, ...definition } as D & { name: T }
}

/** Parse `"Cube.field"` → `{ cube, field }`. */
function parseMember(member: string): { cube: string; field: string } {
  const dot = member.indexOf('.')
  if (dot === -1) throw new Error(`Invalid member format: "${member}" (expected "Cube.field")`)
  return { cube: member.slice(0, dot), field: member.slice(dot + 1) }
}

/** Resolve a cube reference — accepts objects, lazy functions, and string lookups. */
function resolveCube(
  ref: string | (() => Cube) | Cube,
  cubes: ReadonlyMap<string, Cube>,
): Cube | null {
  if (typeof ref === 'string') return cubes.get(ref) ?? null
  return typeof ref === 'function' ? ref() : ref
}

const GRANULARITIES = new Set(['day', 'week', 'month', 'quarter', 'year'])

export { levenshtein }

export function validateQuery(
  cubes: ReadonlyMap<string, Cube>,
  query: Partial<Query>,
): ValidationResult {
  const errors: ValidationError[] = []

  const referencedCubes = new Set<string>()

  const addRef = (member: string) => {
    const dot = member.indexOf('.')
    if (dot === -1) {
      errors.push({ type: 'invalid_filter', message: `Invalid member format: "${member}" (expected Cube.field)`, field: member })
      return
    }
    referencedCubes.add(member.slice(0, dot))
  }

  for (const m of query.measures ?? []) addRef(m)
  for (const d of query.dimensions ?? []) addRef(d)
  for (const td of query.timeDimensions ?? []) addRef(td.dimension)

  for (const cubeName of referencedCubes) {
    if (!cubes.has(cubeName)) {
      const closest = [...cubes.keys()]
        .map(c => ({ name: c, dist: levenshtein(cubeName.toLowerCase(), c.toLowerCase()) }))
        .filter(c => c.dist <= 3)
        .sort((a, b) => a.dist - b.dist)

      errors.push({
        type: 'cube_not_found',
        message: `Cube "${cubeName}" not found`,
        field: cubeName,
        suggestion: closest.length > 0 ? `Did you mean "${closest[0]!.name}"?` : undefined,
      })
    }
  }

  for (const m of query.measures ?? []) {
    const dot = m.indexOf('.')
    if (dot === -1) continue
    const cubeName = m.slice(0, dot)
    const field = m.slice(dot + 1)
    const cube = cubes.get(cubeName)
    if (!cube) continue
    if (!cube.measures[field]) {
      const closest = Object.keys(cube.measures)
        .map(f => ({ name: f, dist: levenshtein(field.toLowerCase(), f.toLowerCase()) }))
        .filter(f => f.dist <= 3)
        .sort((a, b) => a.dist - b.dist)

      errors.push({
        type: 'measure_not_found',
        message: `Measure "${m}" not found on cube "${cubeName}"`,
        field: m,
        suggestion: closest.length > 0 ? `Did you mean "${cubeName}.${closest[0]!.name}"?` : undefined,
      })
    }
  }

  for (const d of query.dimensions ?? []) {
    const dot = d.indexOf('.')
    if (dot === -1) continue
    const cubeName = d.slice(0, dot)
    const field = d.slice(dot + 1)
    const cube = cubes.get(cubeName)
    if (!cube) continue
    if (!cube.dimensions[field]) {
      const closest = Object.keys(cube.dimensions)
        .map(f => ({ name: f, dist: levenshtein(field.toLowerCase(), f.toLowerCase()) }))
        .filter(f => f.dist <= 3)
        .sort((a, b) => a.dist - b.dist)

      errors.push({
        type: 'dimension_not_found',
        message: `Dimension "${d}" not found on cube "${cubeName}"`,
        field: d,
        suggestion: closest.length > 0 ? `Did you mean "${cubeName}.${closest[0]!.name}"?` : undefined,
      })
    }
  }

  for (const td of query.timeDimensions ?? []) {
    const dot = td.dimension.indexOf('.')
    if (dot === -1) continue
    const cubeName = td.dimension.slice(0, dot)
    const field = td.dimension.slice(dot + 1)
    const cube = cubes.get(cubeName)
    if (!cube) continue

    if (!cube.dimensions[field]) {
      errors.push({
        type: 'time_dimension_not_found',
        message: `Time dimension "${td.dimension}" not found on cube "${cubeName}"`,
        field: td.dimension,
      })
    } else if (cube.dimensions[field]!.type !== 'time') {
      errors.push({
        type: 'time_dimension_not_found',
        message: `"${td.dimension}" is not a time dimension (type: ${cube.dimensions[field]!.type})`,
        field: td.dimension,
      })
    }
  }

  return { valid: errors.length === 0, errors }
}


export class CubeQueryCompiler {
  private readonly cubes: ReadonlyMap<string, Cube>
  private readonly dialect: Dialect

  constructor(cubes: ReadonlyMap<string, Cube>, dialect?: Dialect) {
    this.cubes = cubes
    this.dialect = dialect ?? new SnowflakeDialect()
  }

  private resolveSql(sql: string | ((ctx: QueryContext) => string), ctx: QueryContext): string {
    return this.dialect.transformSql(typeof sql === 'function' ? sql(ctx) : sql)
  }

  // public API

  compile(query: Query, ctx?: QueryContext): CompiledQuery {
    const context: QueryContext = { ...ctx, ungrouped: ctx?.ungrouped ?? query.ungrouped }

    // 5a.  Parse & validate
    const cubeNames = this.parseAndValidate(query)

    // 5b.  Pick primary cube (FROM clause)
    const primaryCube = this.pickPrimaryCube(cubeNames)

    // 5c.  Resolve joins
    const joinPlan = this.resolveJoins(primaryCube, cubeNames)

    // 5d.  Plan pre-aggregation CTEs (hasMany)
    const ctePlan = this.planCTEs(joinPlan, query)

    // 5e.  Build SELECT list
    const selections = this.buildSelections(query, primaryCube, joinPlan, ctePlan, context)

    // 5f.  Build FROM + JOINs
    const fromClause = this.buildFromAndJoins(primaryCube, joinPlan, ctePlan, context)

    // 5g.  Build WHERE
    const whereClause = this.buildWhere(query, primaryCube, joinPlan, ctePlan, context)

    // 5h.  Build GROUP BY
    const groupByClause = this.buildGroupBy(selections, query, context, ctePlan)

    // 5i.  Build ORDER BY
    const orderByClause = this.buildOrderBy(query)

    // 5j.  LIMIT / OFFSET
    const limitClause = this.buildLimitOffset(query)

    // 5k.  Assemble
    return this.assemble(ctePlan, selections, fromClause, whereClause, groupByClause, orderByClause, limitClause)
  }

  // parse & validate

  private parseAndValidate(query: Query): Set<string> {
    const cubeNames = new Set<string>()

    const addMember = (member: string) => {
      const { cube } = parseMember(member)
      cubeNames.add(cube)
    }

    for (const m of query.measures) addMember(m)
    for (const d of query.dimensions ?? []) addMember(d)
    for (const td of query.timeDimensions ?? []) addMember(td.dimension)

    // Walk filters recursively
    const visitFilter = (f: Filter | LogicalFilter) => {
      if ('member' in f) {
        addMember(f.member)
      } else {
        for (const child of f.and ?? f.or ?? []) visitFilter(child)
      }
    }
    for (const f of query.filters ?? []) visitFilter(f)

    // Validate cubes exist
    for (const name of cubeNames) {
      if (!this.cubes.has(name)) throw new Error(`Cube not registered: "${name}"`)
    }

    // Validate measures / dimensions / timeDimensions exist on their cubes
    for (const m of query.measures) {
      const { cube, field } = parseMember(m)
      const c = this.cubes.get(cube)!
      if (!c.measures[field]) throw new Error(`Measure "${m}" not found on cube "${cube}"`)
    }
    for (const d of query.dimensions ?? []) {
      const { cube, field } = parseMember(d)
      const c = this.cubes.get(cube)!
      if (!c.dimensions[field]) throw new Error(`Dimension "${d}" not found on cube "${cube}"`)
    }
    for (const td of query.timeDimensions ?? []) {
      const { cube, field } = parseMember(td.dimension)
      if (!GRANULARITIES.has(td.granularity)) {
        throw new Error(`Unsupported time granularity: "${td.granularity}"`)
      }
      const c = this.cubes.get(cube)!
      if (!c.dimensions[field]) throw new Error(`Time dimension "${td.dimension}" not found on cube "${cube}"`)
      if (c.dimensions[field]!.type !== 'time') {
        throw new Error(`Field "${td.dimension}" must have type "time" to be used as a time dimension`)
      }
    }

    if (cubeNames.size === 0) throw new Error('Query must reference at least one cube')

    // Validate time dimension granularity
    for (const td of query.timeDimensions ?? []) {
      if (!GRANULARITIES.has(td.granularity)) {
        throw new Error(`Unsupported time granularity: "${td.granularity}"`)
      }
    }

    return cubeNames
  }

  // pick primary cube

  /** Does `cube` have a direct join (forward or reverse) to `targetName`? */
  private hasDirectJoin(cube: Cube, targetName: string): boolean {
    // Forward: cube.joins → target
    if (cube.joins) {
      for (const j of Object.values(cube.joins)) {
        const target = resolveCube(j.targetCube, this.cubes)
        if (target && target.name === targetName) return true
      }
    }
    // Reverse: target.joins → cube
    const target = this.cubes.get(targetName)
    if (target?.joins) {
      for (const j of Object.values(target.joins)) {
        const t = resolveCube(j.targetCube, this.cubes)
        if (t && t.name === cube.name) return true
      }
    }
    return false
  }

  private pickPrimaryCube(cubeNames: Set<string>): Cube {
    if (cubeNames.size === 1) return this.cubes.get([...cubeNames][0]!)!
    // Pick the first cube that can reach every other cube in a single hop
    for (const name of cubeNames) {
      const cube = this.cubes.get(name)!
      const allReachable = [...cubeNames].every(
        other => other === name || this.hasDirectJoin(cube, other),
      )
      if (allReachable) return cube
    }
    return this.cubes.get([...cubeNames][0]!)!
  }

  // resolve joins

  private resolveJoins(primaryCube: Cube, cubeNames: Set<string>): JoinPlanEntry[] {
    const entries: JoinPlanEntry[] = []

    for (const name of cubeNames) {
      if (name === primaryCube.name) continue

      const cube = this.cubes.get(name)!
      let joinDef: CubeJoin | null = null
      let reversed = false

      // Search forward: primaryCube.joins → target
      if (primaryCube.joins) {
        for (const [, j] of Object.entries(primaryCube.joins)) {
          const target = resolveCube(j.targetCube, this.cubes)
          if (target && target.name === name) {
            joinDef = j
            break
          }
        }
      }

      // Search reverse: targetCube.joins → primary
      if (!joinDef && cube.joins) {
        for (const [, j] of Object.entries(cube.joins)) {
          const target = resolveCube(j.targetCube, this.cubes)
          if (target && target.name === primaryCube.name) {
            joinDef = j
            reversed = true
            break
          }
        }
      }

      if (!joinDef) {
        throw new Error(`No join path from "${primaryCube.name}" to "${name}"`)
      }

      entries.push({
        cube,
        joinType: joinDef.joinType ?? 'left',
        condition: reversed
          ? `${joinDef.keys.target} = ${joinDef.keys.source}`
          : `${joinDef.keys.source} = ${joinDef.keys.target}`,
        isMany: joinDef.relationship === 'hasMany' || joinDef.relationship === 'belongsToMany',
        keys: reversed
          ? { source: joinDef.keys.target, target: joinDef.keys.source }
          : joinDef.keys,
      })
    }

    return entries
  }

  // plan CTEs

  private planCTEs(
    joinPlan: JoinPlanEntry[],
    query: Query,
  ): CTEPlanEntry[] {
    const ctePlan: CTEPlanEntry[] = []

    for (const jp of joinPlan) {
      if (!jp.isMany) continue

      // Only CTE if the cube contributes measures
      const cubeMeasureNames = query.measures.filter(m => m.startsWith(jp.cube.name + '.'))
      if (cubeMeasureNames.length === 0) continue

      const cteAlias = `${jp.cube.name.toLowerCase()}_agg`

      // Collect cube WHERE
      let whereClause: string | undefined
      if (jp.cube.where) {
        whereClause = typeof jp.cube.where === 'function' ? '' : jp.cube.where
      }

      // Collect dimension fields referenced in dimensions, timeDimensions, and filters
      const dimensionFields: string[] = []
      const addField = (f: string) => { if (!dimensionFields.includes(f)) dimensionFields.push(f) }
      for (const d of query.dimensions ?? []) {
        if (d.startsWith(jp.cube.name + '.')) addField(d.split('.')[1]!)
      }
      for (const td of query.timeDimensions ?? []) {
        if (td.dimension.startsWith(jp.cube.name + '.')) addField(td.dimension.split('.')[1]!)
      }
      const collectFilterFields = (f: Filter | LogicalFilter) => {
        if ('member' in f) {
          if (f.member.startsWith(jp.cube.name + '.')) addField(f.member.split('.')[1]!)
        } else {
          for (const child of f.and ?? f.or ?? []) collectFilterFields(child)
        }
      }
      for (const f of query.filters ?? []) collectFilterFields(f)

      ctePlan.push({
        cube: jp.cube,
        cteAlias,
        joinKeySource: jp.keys.source,
        joinKeyTarget: jp.keys.target,
        measures: cubeMeasureNames,
        dimensionFields,
        where: whereClause,
      })
    }

    return ctePlan
  }

  // build selections

  private buildSelections(
    query: Query,
    _primaryCube: Cube,
    _joinPlan: JoinPlanEntry[],
    ctePlan: CTEPlanEntry[],
    ctx: QueryContext,
  ): Selection[] {
    const selections: Selection[] = []

    // Cache of cube → cteAlias for quick lookup
    const cteMap = new Map(ctePlan.map(c => [c.cube.name, c]))

    // Build helper: get the SQL expression for a dimension
    const resolveDim = (cubeName: string, fieldName: string): SqlExpr => {
      const cte = cteMap.get(cubeName)
      if (cte) return raw(`${this.dialect.quoteIdent(cte.cteAlias)}.${this.dialect.quoteIdent(fieldName)}`)
      const cube = this.cubes.get(cubeName)!
      const dim = cube.dimensions[fieldName]!
      return raw(this.resolveSql(dim.sql, ctx))
    }

    // Dimensions
    for (const d of query.dimensions ?? []) {
      const { cube: cubeName, field: fieldName } = parseMember(d)
      const expr = resolveDim(cubeName, fieldName)
      selections.push({ alias: d, expr: sql`${expr}` })
    }

    // Time dimensions
    for (const td of query.timeDimensions ?? []) {
      const { cube: cubeName, field: fieldName } = parseMember(td.dimension)
      const dimSql = resolveDim(cubeName, fieldName)
      const truncated = raw(this.dialect.dateTrunc(td.granularity, dimSql.text))
      selections.push({ alias: td.dimension, expr: truncated })
    }

    // Measures
    const windowSelections: Selection[] = []

    for (const m of query.measures) {
      const { cube: cubeName, field: fieldName } = parseMember(m)
      const cube = this.cubes.get(cubeName)!
      const measure = cube.measures[fieldName]!

      if (!measure.sql && measure.type !== 'calculated' && !this.isWindowType(measure.type)) {
        throw new Error(`Measure "${m}" has no sql property and is not calculated or a window function`)
      }

      let expr: SqlExpr

      // Check if this measure's cube is CTE'd
      const cteEntry = cteMap.get(cubeName)

      if (measure.type === 'calculated') {
        expr = this.buildCalculatedMeasureSql(measure, m, cteEntry, ctx)
      } else if (this.isWindowType(measure.type)) {
        // Window functions are built separately after all regular selections
        const winExpr = this.buildWindowMeasureSql(
          measure,
          cubeName,
          fieldName,
          ctx,
        )
        windowSelections.push({ alias: m, expr: winExpr })
        continue
      } else if (cteEntry) {
        // Reference CTE alias column
        const cteCol = sql`${raw(this.dialect.quoteIdent(cteEntry.cteAlias))}.${raw(this.dialect.quoteIdent(fieldName))}`
        const agg = this.cteReAggregation(measure.type, cteCol)
        expr = agg
      } else {
        const baseExpr = raw(this.resolveSql(measure.sql!, ctx))
        expr = this.buildMeasureAggregation(measure, baseExpr, ctx)
      }

      selections.push({ alias: m, expr })
    }

    // Append window selections after regular selections
    selections.push(...windowSelections)

    return selections
  }

  private isWindowType(type: MeasureType): boolean {
    return [
      'lag', 'lead', 'rank', 'denseRank', 'rowNumber',
      'ntile', 'firstValue', 'lastValue', 'movingAvg', 'movingSum',
    ].includes(type)
  }

  private buildMeasureAggregation(measure: Measure, baseExpr: SqlExpr, ctx: QueryContext): SqlExpr {
    const t = measure.type

    // Ungrouped queries don't wrap in aggregation
    if (ctx.ungrouped) return baseExpr

    // Apply measure-level filters via dialect
    const filtered = this.applyMeasureFilter(measure, baseExpr, ctx)

    switch (t) {
      case 'count':
      case 'sum':
      case 'avg':
      case 'min':
      case 'max':
      case 'number':
        return raw(this.dialect.aggregateFunction(t, filtered.text))
      case 'countDistinct':
        return raw(this.dialect.aggregateFunction('countDistinct', filtered.text))
      case 'countDistinctApprox':
        return raw(this.dialect.approxCountDistinct(filtered.text))
      case 'stddev':
        return raw(this.dialect.stddevPop(filtered.text))
      case 'stddevSamp':
        return raw(this.dialect.stddevSamp(filtered.text))
      case 'variance':
        return raw(this.dialect.varPop(filtered.text))
      case 'varianceSamp':
        return raw(this.dialect.varSamp(filtered.text))
      case 'percentile':
        return raw(this.dialect.percentileCont(measure.statisticalConfig?.percentile ?? 50, filtered.text))
      case 'median':
        return raw(this.dialect.percentileCont(50, filtered.text))
      case 'p95':
        return raw(this.dialect.percentileCont(95, filtered.text))
      case 'p99':
        return raw(this.dialect.percentileCont(99, filtered.text))
      default:
        return raw(this.dialect.aggregateFunction(t, filtered.text))
    }
  }

  private applyMeasureFilter(measure: Measure, baseExpr: SqlExpr, ctx: QueryContext): SqlExpr {
    if (!measure.filters || measure.filters.length === 0) return baseExpr

    const conditions: string[] = []
    for (const f of measure.filters) {
      const cond = f(ctx)
      if (cond) conditions.push(cond)
    }

    if (conditions.length === 0) return baseExpr

    const combined = conditions.join(' AND ')
    return raw(this.dialect.applyFilterClause(baseExpr.text, combined))
  }

  private buildWindowMeasureSql(
    measure: Measure,
    cubeName: string,
    _fieldName: string,
    ctx: QueryContext,
  ): SqlExpr {
    const cfg = measure.windowConfig ?? {}
    const cube = this.cubes.get(cubeName)!

    // Build window function name
    const fnMap: Record<string, string> = {
      lag: 'LAG',
      lead: 'LEAD',
      rank: 'RANK',
      denseRank: 'DENSE_RANK',
      rowNumber: 'ROW_NUMBER',
      ntile: 'NTILE',
      firstValue: 'FIRST_VALUE',
      lastValue: 'LAST_VALUE',
      movingAvg: 'AVG',
      movingSum: 'SUM',
    }

    const fnName = fnMap[measure.type]
    if (!fnName) throw new Error(`Unknown window function type: "${measure.type}"`)

    // Base expression (null for rank/denseRank/rowNumber)
    const baseSql = measure.sql
      ? raw(this.resolveSql(measure.sql, ctx))
      : undefined

    const needsArg = !['rank', 'denseRank', 'rowNumber'].includes(measure.type)
    let fnCall: SqlExpr

    if (measure.type === 'ntile') {
      fnCall = sql`${raw(fnName)}(${raw(String(cfg.nTile ?? 1))})`
    } else if (needsArg && baseSql) {
      // Build args: for lag/lead, include offset and default
      if (measure.type === 'lag' || measure.type === 'lead') {
        const args: SqlExpr[] = [baseSql]
        if (cfg.offset !== undefined) args.push(raw(String(cfg.offset)))
        if (cfg.defaultValue !== undefined) args.push(sql`${raw(String(cfg.defaultValue))}`)
        fnCall = sql`${raw(fnName)}(${args.reduce((a, b) => sql`${a}, ${b}`)})`
      } else {
        fnCall = sql`${raw(fnName)}(${baseSql})`
      }
    } else {
      fnCall = raw(`${fnName}()`)
    }

    // Build OVER clause
    const overParts: string[] = []

    if (cfg.partitionBy && cfg.partitionBy.length > 0) {
      const parts = cfg.partitionBy.map((ref: string) => {
        const field = ref.includes('.') ? parseMember(ref).field : ref
        const dim = cube.dimensions[field]
        if (!dim) throw new Error(`Window partition dimension "${ref}" not found on "${cubeName}"`)
        return this.resolveSql(dim.sql, ctx)
      })
      overParts.push(`PARTITION BY ${parts.join(', ')}`)
    }

    if (cfg.orderBy && cfg.orderBy.length > 0) {
      const parts = cfg.orderBy.map((o: { field: string; direction: 'asc' | 'desc' }) => {
        const field = o.field.includes('.') ? parseMember(o.field).field : o.field
        const dim = cube.dimensions[field]
        if (!dim) throw new Error(`Window order field "${o.field}" not found on "${cubeName}"`)
        return `${this.resolveSql(dim.sql, ctx)} ${o.direction}`
      })
      overParts.push(`ORDER BY ${parts.join(', ')}`)
    }

    // Frame clause for moving aggregates
    if (cfg.frame) {
      const start = cfg.frame.start === 'unbounded' ? 'UNBOUNDED PRECEDING' : `${cfg.frame.start} PRECEDING`
      const end = cfg.frame.end === 'current' ? 'CURRENT ROW' : cfg.frame.end === 'unbounded' ? 'UNBOUNDED FOLLOWING' : `${cfg.frame.end} FOLLOWING`
      overParts.push(`${cfg.frame.type.toUpperCase()} BETWEEN ${start} AND ${end}`)
    }

    const overClause = overParts.length > 0 ? ` OVER (${overParts.join(' ')})` : ' OVER ()'
    return raw(`${fnCall.text}${overClause}`)
  }

  private buildCalculatedMeasureSql(
    measure: Measure,
    measureName: string,
    cteEntry: CTEPlanEntry | undefined,
    ctx: QueryContext,
  ): SqlExpr {
    if (!measure.calculatedSql) {
      throw new Error(`Calculated measure "${measureName}" missing calculatedSql`)
    }

    let sqlStr = measure.calculatedSql

    // Replace {Cube.field} references with actual SQL
    sqlStr = sqlStr.replace(/\{(\w+)\.(\w+)\}/g, (_match, cubeName: string, fieldName: string) => {
      const refName = `${cubeName}.${fieldName}`
      const cube = this.cubes.get(cubeName)
      if (!cube) throw new Error(`Calculated measure "${measureName}" references unknown cube "${cubeName}"`)

      // If this dependency is a measure, build its expression
      if (cube.measures[fieldName]) {
        const depMeasure = cube.measures[fieldName]!
        if (cteEntry && cteEntry.measures.includes(refName)) {
          // Reference CTE column
          const cteCol = sql`${raw(this.dialect.quoteIdent(cteEntry.cteAlias))}.${raw(this.dialect.quoteIdent(fieldName))}`
          const agg = this.cteReAggregation(depMeasure.type, cteCol)
          return agg.text
        }
        if (depMeasure.type === 'calculated') {
          throw new Error(
            `Calculated measure "${measureName}" depends on calculated measure "${refName}". ` +
            `Nested calculated measures are not supported — inline the dependency's formula.`,
          )
        }
        if (!depMeasure.sql) {
          throw new Error(`Calculated measure "${measureName}" references measure "${refName}" which has no sql`)
        }
        const depSql = this.resolveSql(depMeasure.sql, ctx)
        const agg = this.buildMeasureAggregation(depMeasure, raw(depSql), ctx)
        return agg.text
      }

      // If it's a dimension, just reference its SQL
      if (cube.dimensions[fieldName]) {
        const dim = cube.dimensions[fieldName]!
        return this.resolveSql(dim.sql, ctx)
      }

      throw new Error(
        `Calculated measure "${measureName}" references "${refName}" which is not a measure or dimension on "${cubeName}"`,
      )
    })

    return raw(`(${sqlStr})`)
  }

  private cteReAggregation(type: MeasureType, cteCol: SqlExpr): SqlExpr {
    return raw(this.dialect.cteReAggregate(type, cteCol.text))
  }

  // build FROM + JOINs

  private buildFromAndJoins(
    primaryCube: Cube,
    joinPlan: JoinPlanEntry[],
    ctePlan: CTEPlanEntry[],
    ctx: QueryContext,
  ): SqlExpr {
    const cteSet = new Set(ctePlan.map(c => c.cube.name))
    const parts: SqlExpr[] = [sql`\nFROM ${raw(primaryCube.sql)}`]

    for (const jp of joinPlan) {
      const joinKeyword = jp.joinType === 'inner' ? 'JOIN' : `${jp.joinType.toUpperCase()} JOIN`
      const cte = cteSet.has(jp.cube.name)
        ? ctePlan.find(c => c.cube.name === jp.cube.name)!
        : null

      if (cte) {
        // Build the ON clause using explicit keys
        const targetCol = cte.joinKeyTarget.replace(/^[^.]+\./, '')
        const rewritten = `${cte.cteAlias}.${targetCol} = ${cte.joinKeySource}`
        parts.push(sql`\n${raw(joinKeyword)} ${raw(this.dialect.quoteIdent(cte.cteAlias))} ON ${raw(rewritten)}`)
      } else {
        // Apply cube-level WHERE as part of the JOIN ON for LEFT/RIGHT/FULL
        // to preserve NULL rows; for INNER join it goes in the main WHERE.
        let condition = jp.condition

        // For non-INNER joins, incorporate cube security WHERE into the ON clause
        if (jp.joinType !== 'inner' && jp.cube.where) {
          const whereStr =
            typeof jp.cube.where === 'function'
              ? jp.cube.where(ctx)
              : jp.cube.where
          if (whereStr) {
            condition = `(${condition}) AND (${whereStr})`
          }
        }

        parts.push(sql`\n${raw(joinKeyword)} ${raw(jp.cube.sql)} ON ${raw(condition)}`)
      }
    }

    return parts.reduce((a, b) => sql`${a}${b}`)
  }

  // build WHERE

  private buildWhere(
    query: Query,
    primaryCube: Cube,
    joinPlan: JoinPlanEntry[],
    ctePlan: CTEPlanEntry[],
    ctx: QueryContext,
  ): SqlExpr | null {
    const conditions: SqlExpr[] = []
    const cteSet = new Set(ctePlan.map(c => c.cube.name))

    // Primary cube security WHERE
    if (primaryCube.where) {
      const w = typeof primaryCube.where === 'function' ? primaryCube.where(ctx) : primaryCube.where
      if (w) conditions.push(raw(`(${w})`))
    }

    // Joined cubes' security WHERE (only for INNER joins — others have it in ON clause)
    for (const jp of joinPlan) {
      if (cteSet.has(jp.cube.name)) continue // CTE handles its own security inside
      if (jp.joinType === 'inner' && jp.cube.where) {
        const w = typeof jp.cube.where === 'function' ? jp.cube.where(ctx) : jp.cube.where
        if (w) conditions.push(raw(`(${w})`))
      }
    }

    // Query filters
    for (const f of query.filters ?? []) {
      const cond = this.buildFilterCondition(f, ctx, ctePlan)
      if (cond) conditions.push(sql`(${cond})`)
    }

    if (conditions.length === 0) return null

    const combined = conditions.reduce((a, b) => sql`${a} AND ${b}`)
    return sql`\nWHERE ${combined}`
  }

  /** Resolve a filter field's SQL expression as a string. */
  private resolveFilterField(member: string, ctx: QueryContext, ctePlan: CTEPlanEntry[]): string {
    const { cube: cubeName, field: fieldName } = parseMember(member)
    const cube = this.cubes.get(cubeName)!

    // If this cube is CTE'd, reference the CTE alias column (for dimensions)
    const cte = ctePlan.find(c => c.cube.name === cubeName)
    if (cte && cube.dimensions[fieldName]) {
      return `${this.dialect.quoteIdent(cte.cteAlias)}.${this.dialect.quoteIdent(fieldName)}`
    }

    if (cube.measures[fieldName]) {
      const m = cube.measures[fieldName]!
      if (m.type === 'calculated') throw new Error(`Cannot filter on calculated measure "${member}"`)
      return this.resolveSql(m.sql!, ctx)
    }
    if (cube.dimensions[fieldName]) {
      const d = cube.dimensions[fieldName]!
      return this.resolveSql(d.sql, ctx)
    }
    throw new Error(`Filter field "${member}" not found on cube "${cubeName}"`)
  }

  private buildFilterCondition(filter: Filter | LogicalFilter, ctx?: QueryContext, ctePlan?: CTEPlanEntry[]): SqlExpr | null {
    // Logical filter
    if ('and' in filter || 'or' in filter) {
      const lf = filter as LogicalFilter
      if (lf.and) {
        const parts = lf.and.map(c => this.buildFilterCondition(c, ctx, ctePlan)).filter(Boolean) as SqlExpr[]
        if (parts.length === 0) return null
        return parts.reduce((a, b) => sql`${a} AND ${b}`)
      }
      if (lf.or) {
        const parts = lf.or.map(c => this.buildFilterCondition(c, ctx, ctePlan)).filter(Boolean) as SqlExpr[]
        if (parts.length === 0) return null
        return parts.reduce((a, b) => sql`${a} OR ${b}`)
      }
      return null
    }

    const f = filter as Filter
    const fieldSql = this.resolveFilterField(f.member, ctx ?? {}, ctePlan ?? [])
    const vals = f.values ?? []

    switch (f.operator) {
      case 'equals':
        if (vals.length === 0) return raw('1=0')
        if (vals[0] === null || vals[0] === undefined) return raw(`${fieldSql} IS NULL`)
        if (vals.length === 1) return new SqlExpr(`${fieldSql} = ?`, [vals[0]])
        return new SqlExpr(`${fieldSql} IN (${vals.map(() => '?').join(', ')})`, vals)

      case 'notEquals':
        if (vals.length === 0) return raw('1=1')
        if (vals[0] === null || vals[0] === undefined) return raw(`${fieldSql} IS NOT NULL`)
        if (vals.length === 1) return new SqlExpr(`${fieldSql} != ?`, [vals[0]])
        return new SqlExpr(`${fieldSql} NOT IN (${vals.map(() => '?').join(', ')})`, vals)

      case 'contains':
        return new SqlExpr(this.dialect.searchPattern(fieldSql, 'contains'), [vals[0]])
      case 'notContains':
        return new SqlExpr(this.dialect.searchPattern(fieldSql, 'notContains'), [vals[0]])
      case 'startsWith':
        return new SqlExpr(this.dialect.searchPattern(fieldSql, 'startsWith'), [vals[0]])
      case 'endsWith':
        return new SqlExpr(this.dialect.searchPattern(fieldSql, 'endsWith'), [vals[0]])

      case 'gt':
        return new SqlExpr(`${fieldSql} > ?`, [vals[0]])
      case 'gte':
        return new SqlExpr(`${fieldSql} >= ?`, [vals[0]])
      case 'lt':
        return new SqlExpr(`${fieldSql} < ?`, [vals[0]])
      case 'lte':
        return new SqlExpr(`${fieldSql} <= ?`, [vals[0]])

      case 'inDateRange':
        if (vals.length < 2) return raw('1=1')
        return new SqlExpr(`${fieldSql} >= ? AND ${fieldSql} < ?`, [vals[0], vals[1]])
      case 'notInDateRange':
        if (vals.length < 2) return raw('1=1')
        return new SqlExpr(`NOT (${fieldSql} >= ? AND ${fieldSql} < ?)`, [vals[0], vals[1]])
      case 'beforeDate':
        return new SqlExpr(`${fieldSql} < ?`, [vals[0]])
      case 'afterDate':
        return new SqlExpr(`${fieldSql} >= ?`, [vals[0]])

      case 'set':
        return raw(`${fieldSql} IS NOT NULL`)
      case 'notSet':
        return raw(`${fieldSql} IS NULL`)

      default:
        throw new Error(`Unknown filter operator: "${f.operator}"`)
    }
  }

  // build GROUP BY

  private buildGroupBy(
    _selections: Selection[],
    query: Query,
    ctx: QueryContext,
    ctePlan: CTEPlanEntry[],
  ): SqlExpr | null {
    if (ctx.ungrouped) return null

    const cteMap = new Map(ctePlan.map(c => [c.cube.name, c]))
    const groupFields: string[] = []

    for (const td of query.timeDimensions ?? []) {
      const { cube: cubeName, field: fieldName } = parseMember(td.dimension)
      const cte = cteMap.get(cubeName)
      if (cte) {
        groupFields.push(this.dialect.dateTrunc(td.granularity, `${this.dialect.quoteIdent(cte.cteAlias)}.${this.dialect.quoteIdent(fieldName)}`))
      } else {
        const cube = this.cubes.get(cubeName)!
        const dim = cube.dimensions[fieldName]!
        groupFields.push(this.dialect.dateTrunc(td.granularity, this.resolveSql(dim.sql, ctx)))
      }
    }

    for (const d of query.dimensions ?? []) {
      const { cube: cubeName, field: fieldName } = parseMember(d)
      const cte = cteMap.get(cubeName)
      if (cte) {
        groupFields.push(`${this.dialect.quoteIdent(cte.cteAlias)}.${this.dialect.quoteIdent(fieldName)}`)
      } else {
        const cube = this.cubes.get(cubeName)!
        const dim = cube.dimensions[fieldName]!
        groupFields.push(this.resolveSql(dim.sql, ctx))
      }
    }

    if (groupFields.length === 0) return null

    return sql`\nGROUP BY ${raw(groupFields.join(', '))}`
  }

  // build ORDER BY

  private buildOrderBy(query: Query): SqlExpr | null {
    const order = query.order ?? {}

    // Auto-add time dimension ordering if no explicit order exists
    if (Object.keys(order).length === 0 && (query.timeDimensions?.length ?? 0) > 0) {
      return sql`\nORDER BY ${raw(this.dialect.quoteIdent(query.timeDimensions![0]!.dimension))} ASC`
    }

    if (Object.keys(order).length === 0) return null

    const clauses = Object.entries(order).map(
      ([field, dir]) => `${this.dialect.quoteIdent(field)} ${dir}`,
    )
    return sql`\nORDER BY ${raw(clauses.join(', '))}`
  }

  // LIMIT / OFFSET

  private buildLimitOffset(query: Query): SqlExpr | null {
    if (query.limit === undefined && query.offset === undefined) return null

    const parts: string[] = []
    if (query.limit !== undefined) parts.push(`LIMIT ${query.limit}`)
    if (query.offset !== undefined) parts.push(`OFFSET ${query.offset}`)
    return raw(`\n${parts.join(' ')}`)
  }

  // assemble

  private assemble(
    ctePlan: CTEPlanEntry[],
    selections: Selection[],
    fromClause: SqlExpr,
    whereClause: SqlExpr | null,
    groupByClause: SqlExpr | null,
    orderByClause: SqlExpr | null,
    limitClause: SqlExpr | null,
  ): CompiledQuery {
    const params: unknown[] = []
    const fragments: string[] = []

    const emit = (s: SqlExpr) => {
      fragments.push(s.text)
      params.push(...s.params)
    }

    // CTEs
    if (ctePlan.length > 0) {
      fragments.push('WITH ')
      for (let i = 0; i < ctePlan.length; i++) {
        const cte = ctePlan[i]!
        if (i > 0) fragments.push(', ')

        fragments.push(`${cte.cteAlias} AS (`)

        // Build inner SELECT for CTE
        const cteSelects: string[] = cte.measures.map(m => {
          const { field } = parseMember(m)
          const measure = cte.cube.measures[field]!; if (!measure.sql) return ''
          const baseSql = typeof measure.sql === 'function' ? '' : this.dialect.transformSql(measure.sql as string)
          let agg: string
          switch (measure.type) {
            case 'count':
              agg = `COUNT(${baseSql})`
              break
            case 'countDistinct':
              agg = `COUNT(DISTINCT ${baseSql})`
              break
            case 'sum':
              agg = `SUM(${baseSql})`
              break
            case 'avg':
              agg = `AVG(${baseSql})`
              break
            case 'min':
              agg = `MIN(${baseSql})`
              break
            case 'max':
              agg = `MAX(${baseSql})`
              break
            default:
              agg = `COUNT(${baseSql})`
          }
          return `${agg} AS ${field}`
        })

        // Join key column
        cteSelects.unshift(cte.joinKeyTarget)

        // Dimension fields (for GROUP BY and referencing from outer query)
        for (const df of cte.dimensionFields) {
          const dim = cte.cube.dimensions[df]
          if (dim) {
            const dimSql = typeof dim.sql === 'function' ? '' : this.dialect.transformSql(dim.sql as string)
            cteSelects.push(`${dimSql} AS ${df}`)
          }
        }

        fragments.push(`SELECT ${cteSelects.join(', ')} FROM ${cte.cube.sql}`)

        // WHERE inside CTE
        if (cte.where) {
          fragments.push(` WHERE ${cte.where}`)
        }

        // GROUP BY — join key + dimension fields
        const cteGroupBy: string[] = [cte.joinKeyTarget]
        for (const df of cte.dimensionFields) {
          const dim = cte.cube.dimensions[df]
          if (dim) {
            const dimSql = typeof dim.sql === 'function' ? '' : this.dialect.transformSql(dim.sql as string)
            cteGroupBy.push(dimSql)
          }
        }
        fragments.push(` GROUP BY ${cteGroupBy.join(', ')}`)
        fragments.push(')')
      }
    }

    // SELECT
    fragments.push('\nSELECT ')
    const selectParts = selections.map(
      s => `${s.expr.text} AS ${this.dialect.quoteIdent(s.alias)}`,
    )
    fragments.push(selectParts.join(', '))

    // FROM + JOINs
    emit(fromClause)

    // WHERE
    if (whereClause) emit(whereClause)

    // GROUP BY
    if (groupByClause) emit(groupByClause)

    // ORDER BY
    if (orderByClause) emit(orderByClause)

    // LIMIT / OFFSET
    if (limitClause) emit(limitClause)

    return { sql: fragments.join(''), params }
  }
}


/** Minimal Snowflake connection interface (compatible with snowflake-sdk). */
export interface SnowflakeConnection {
  execute(options: {
    sqlText: string
    binds: unknown[]
    complete?: (err: Error | undefined, stmt: any) => void
  }): {
    toStream: (callback: (err: Error | undefined, rows: any[]) => void) => void
  } & PromiseLike<{ rows: Record<string, unknown>[] }>
}

export async function executeQuery(
  connection: SnowflakeConnection,
  query: Query,
  cubes: ReadonlyMap<string, Cube>,
  ctx?: QueryContext,
): Promise<QueryResult> {
  const compiler = new CubeQueryCompiler(cubes)
  const compiled = compiler.compile(query, ctx)

  const result = await connection.execute({
    sqlText: compiled.sql,
    binds: compiled.params,
  })

  // Handle both Promise-based and callback-based snowflake-sdk APIs
  const rows: Record<string, unknown>[] = await (result as any)

  return {
    sql: compiled.sql,
    params: compiled.params,
    data: rows,
  }
}


export { Dialect } from './dialects/Dialect.ts'
export { SnowflakeDialect } from './dialects/SnowDialect.ts'
export { SqliteDialect } from './dialects/SqliteDialect.ts'

export type {
  CompiledQuery as CompiledQueryType, CubeJoin as CubeJoinType, Cube as CubeType, DimensionType as DimensionTypeUnion, Dimension as DimTypeDef, FilterOperator as FilterOperatorType, Filter as FilterType,
  LogicalFilter as LogicalFilterType, Measure as MeasureTypeDef, MeasureType as MeasureTypeUnion, QueryContext as QueryContextType,
  QueryResult as QueryResultType, Query as QueryType, Relationship as RelationshipType, TimeDimension as TimeDimensionType
}

