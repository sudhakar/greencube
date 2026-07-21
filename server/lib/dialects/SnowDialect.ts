import { Dialect } from './Dialect.ts'

export class SnowflakeDialect extends Dialect {
  quoteIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`
  }

  dateTrunc(granularity: string, expr: string): string {
    return `DATE_TRUNC('${granularity}', ${expr})`
  }

  approxCountDistinct(expr: string): string {
    return `APPROX_COUNT_DISTINCT(${expr})`
  }

  stddevPop(expr: string): string {
    return `STDDEV_POP(${expr})`
  }

  stddevSamp(expr: string): string {
    return `STDDEV_SAMP(${expr})`
  }

  varPop(expr: string): string {
    return `VAR_POP(${expr})`
  }

  varSamp(expr: string): string {
    return `VAR_SAMP(${expr})`
  }

  percentileCont(percentile: number, expr: string): string {
    return `PERCENTILE_CONT(${percentile / 100}) WITHIN GROUP (ORDER BY ${expr})`
  }

  applyFilterClause(expr: string, condition: string): string {
    return `${expr} FILTER (WHERE ${condition})`
  }

  searchPattern(expr: string, op: string): string {
    switch (op) {
      case 'contains':
        return `${expr} ILIKE '%' || ? || '%'`
      case 'notContains':
        return `${expr} NOT ILIKE '%' || ? || '%'`
      case 'startsWith':
        return `${expr} ILIKE ? || '%'`
      case 'endsWith':
        return `${expr} ILIKE '%' || ?`
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
  }
}