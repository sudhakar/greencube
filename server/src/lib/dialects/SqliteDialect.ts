import { Dialect } from './Dialect.ts'

export class SqliteDialect extends Dialect {
  quoteIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`
  }

  dateTrunc(granularity: string, expr: string): string {
    switch (granularity) {
      case 'day':
        return `DATE(${expr})`
      case 'week':
        return `DATE(${expr}, '-' || strftime('%w', ${expr}) || ' days')`
      case 'month':
        return `DATE(${expr}, 'start of month')`
      case 'quarter':
        return `DATE(${expr}, 'start of month', printf('-%d months', (CAST(strftime('%m', ${expr}) AS INTEGER) - 1) % 3))`
      case 'year':
        return `DATE(${expr}, 'start of year')`
      default:
        throw new Error(`Unsupported granularity: "${granularity}"`)
    }
  }

  approxCountDistinct(expr: string): string {
    return `COUNT(DISTINCT ${expr})`
  }

  stddevPop(_expr: string): string {
    throw new Error('STDDEV_POP is not supported by SQLite')
  }

  stddevSamp(_expr: string): string {
    throw new Error('STDDEV_SAMP is not supported by SQLite')
  }

  varPop(_expr: string): string {
    throw new Error('VAR_POP is not supported by SQLite')
  }

  varSamp(_expr: string): string {
    throw new Error('VAR_SAMP is not supported by SQLite')
  }

  percentileCont(_percentile: number, _expr: string): string {
    throw new Error('PERCENTILE_CONT is not supported by SQLite')
  }

  applyFilterClause(expr: string, condition: string): string {
    return `CASE WHEN ${condition} THEN ${expr} END`
  }

  searchPattern(expr: string, op: string): string {
    switch (op) {
      case 'contains':
        return `${expr} LIKE '%' || ? || '%'`
      case 'notContains':
        return `${expr} NOT LIKE '%' || ? || '%'`
      case 'startsWith':
        return `${expr} LIKE ? || '%'`
      case 'endsWith':
        return `${expr} LIKE '%' || ?`
      default:
        throw new Error(`Unknown search pattern operator: "${op}"`)
    }
  }

  aggregateFunction(type: string, expr: string): string {
    switch (type) {
      case 'countDistinct':
        return `COUNT(DISTINCT ${expr})`
      case 'count':
        return expr ? `COUNT(${expr})` : 'COUNT(*)'
      case 'sum':
        return `SUM(${expr})`
      case 'avg':
        return `AVG(${expr})`
      case 'min':
        return `MIN(${expr})`
      case 'max':
        return `MAX(${expr})`
      default:
        throw new Error(`Unknown aggregate type: "${type}"`)
    }
  }

  cteReAggregate(type: string, colExpr: string): string {
    switch (type) {
      case 'avg':
        return `AVG(${colExpr})`
      case 'min':
        return `MIN(${colExpr})`
      default:
        return `MAX(${colExpr})`
    }
  }

  transformSql(sql: string): string {
    return sql
      .replace(
        /DATEDIFF\('day',\s*([^,]+),\s*([^)]+)\)/g,
        'JULIANDAY($2) - JULIANDAY($1)',
      )
      .replace(
        /DATEDIFF\('year',\s*([^,]+),\s*CURRENT_DATE\)/g,
        "CAST((julianday('now') - julianday($1)) / 365.25 AS INTEGER)",
      )
  }
}
