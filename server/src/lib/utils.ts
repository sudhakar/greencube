import type { Connection, Binds } from 'snowflake-sdk'
import type { Cube } from './GreenCube.ts'

// =============================================================================
// formatMeta — API metadata helper
// =============================================================================

export function formatMeta(
  cubes: ReadonlyMap<string, Cube>,
  routes?: { method: string; path: string; description: string }[],
  samples?: { name: string; json: Record<string, unknown> }[],
) {
  const result: Array<{
    name: string
    measures: { name: string; title: string; type: string }[]
    dimensions: { name: string; title: string; type: string }[]
    timeDimensions: { name: string; title: string; type: string }[]
    sampleQueries?: string[]
  }> = []
  for (const [name, cube] of cubes) {
    const measures = Object.entries(cube.measures).map(([mName, m]) => ({
      name: `${name}.${mName}`,
      title: m.title ?? mName,
      type: m.type,
    }))
    const dimensions: { name: string; title: string; type: string }[] = []
    const timeDimensions: { name: string; title: string; type: string }[] = []
    for (const [dName, d] of Object.entries(cube.dimensions)) {
      const ref = `${name}.${dName}`
      const entry = { name: ref, title: d.title ?? dName, type: d.type }
      if (d.type === 'time') timeDimensions.push(entry)
      else dimensions.push(entry)
    }
    result.push({ name, measures, dimensions, timeDimensions, sampleQueries: cube.sampleQueries })
  }
  const meta: Record<string, unknown> = { cubes: result }
  if (routes) {
    meta.name = 'GreenCube API'
    meta.routes = routes
  }
  if (samples) meta.samples = samples
  return meta
}

// =============================================================================
// exec — execute SQL via a Snowflake connection
// =============================================================================

export function exec(
  conn: Connection | null,
  sql: string,
  binds: Binds | undefined,
): Promise<Record<string, unknown>[]> {
  if (!conn) return Promise.reject(new Error('No database connected'))
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) reject(err)
        else resolve(rows as Record<string, unknown>[])
      },
    })
  })
}

// =============================================================================
// Explain tree helpers
// =============================================================================

export interface ExplainNode {
  id: string
  operation: string
  target: string
  expressions: string
  cardinality?: number
  bytes?: number
  children: ExplainNode[]
}

export function formatExplain(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '(no explain rows)'

  const cols = Object.keys(rows[0]!)

  if (cols.includes('id') && cols.includes('operation')) {
    return formatSnowflakeExplain(rows)
  }

  if (cols.includes('addr') && cols.includes('opcode')) {
    return formatSqliteVdbe(rows)
  }

  return formatGenericExplain(rows)
}

function formatSnowflakeExplain(rows: Record<string, unknown>[]): string {
  const map = new Map<string, ExplainNode>()
  const roots: ExplainNode[] = []

  for (const row of rows) {
    const id = String(row.id ?? '')
    const node: ExplainNode = {
      id,
      operation: String(row.operation ?? ''),
      target: String(row.target ?? ''),
      expressions: String(row.expressions ?? ''),
      cardinality: row.cardinality != null ? Number(row.cardinality) : undefined,
      bytes: row.bytes != null ? Number(row.bytes) : undefined,
      children: [],
    }
    map.set(id, node)
  }

  for (const row of rows) {
    const id = String(row.id ?? '')
    const parent = row.parent != null ? String(row.parent) : ''
    const node = map.get(id)!
    if (parent && map.has(parent)) {
      map.get(parent)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots.map(n => renderSnowflakeNode(n)).join('\n')
}

function renderSnowflakeNode(node: ExplainNode, indent: number = 0): string {
  const parts: string[] = []
  const stats: string[] = []
  if (node.cardinality != null) stats.push(`rows: ${node.cardinality.toLocaleString()}`)
  if (node.bytes != null && node.bytes > 0) {
    stats.push(`bytes: ${node.bytes >= 1024 * 1024 ? (node.bytes / 1024 / 1024).toFixed(1) + 'MB' : node.bytes >= 1024 ? (node.bytes / 1024).toFixed(1) + 'KB' : node.bytes + 'B'}`)
  }
  const statsStr = stats.length > 0 ? ` (${stats.join(', ')})` : ''
  const label = node.target
    ? `${node.operation} (${node.target})${statsStr}`
    : node.expressions
      ? `${node.operation}: ${node.expressions}${statsStr}`
      : `${node.operation}${statsStr}`
  if (!label.trim()) return ''
  parts.push(`${'  '.repeat(indent)}${label}`)
  for (const child of node.children) {
    const r = renderSnowflakeNode(child, indent + 1)
    if (r) parts.push(r)
  }
  return parts.join('\n')
}

function formatSqliteVdbe(rows: Record<string, unknown>[]): string {
  const lines: string[] = []
  for (const row of rows) {
    const addr = String(row.addr ?? '').padStart(3)
    const opcode = String(row.opcode ?? '').padEnd(14)
    const p1 = String(row.p1 ?? '').padStart(3)
    const p2 = String(row.p2 ?? '').padStart(4)
    const p3 = String(row.p3 ?? '').padStart(4)
    const p4 = String(row.p4 ?? '').padEnd(16)
    const comment = String(row.comment ?? '')
    lines.push(`${addr}  ${opcode} ${p1} ${p2} ${p3}  ${p4} ${comment}`.trimEnd())
  }
  return lines.length > 0 ? lines.join('\n') : '(empty plan)'
}

function formatGenericExplain(rows: Record<string, unknown>[]): string {
  return rows.map((r, i) => `#${i}: ${JSON.stringify(r)}`).join('\n')
}

// =============================================================================
// Levenshtein distance
// =============================================================================

export function levenshtein(a: string, b: string): number {
  const al = a.length
  const bl = b.length
  const m = new Array<number>(bl + 1)
  for (let j = 0; j <= bl; j++) m[j] = j
  for (let i = 1; i <= al; i++) {
    let prev = i
    for (let j = 1; j <= bl; j++) {
      const cur = a[i - 1] === b[j - 1] ? m[j - 1] : 1 + Math.min(m[j - 1], prev, m[j])
      m[j - 1] = prev
      prev = cur
    }
    m[bl] = prev
  }
  return m[bl]
}

// =============================================================================
// Tokenize and score for NL matching
// =============================================================================

export function tokenize(text: string): string[] {
  if (!text) return []
  const camelSplit = text.replace(/([a-z])([A-Z])/g, '$1 $2')
  return camelSplit.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

export function scoreTokens(queryTokens: string[], targetTokens: string[]): { score: number; matched: boolean } {
  let score = 0
  let matched = false
  for (const qt of queryTokens) {
    for (const tt of targetTokens) {
      if (tt.includes(qt) && qt.length >= 3) {
        score += 3
        matched = true
      } else if (levenshtein(qt, tt) <= 2) {
        score += 1
        matched = true
      }
    }
  }
  return { score, matched }
}

/** Strip table alias prefix from a dimension SQL expression.
 *  'e.name' → 'name', 'd.id' → 'id'.
 *  Computed expressions (non-matching) are returned as-is. */
export function fieldToColumn(sql: string): string {
  return sql.replace(/^\w+\./, '')
}
