export abstract class Dialect {
  abstract quoteIdent(name: string): string
  abstract dateTrunc(granularity: string, expr: string): string
  abstract approxCountDistinct(expr: string): string
  abstract stddevPop(expr: string): string
  abstract stddevSamp(expr: string): string
  abstract varPop(expr: string): string
  abstract varSamp(expr: string): string
  abstract percentileCont(percentile: number, expr: string): string
  abstract applyFilterClause(expr: string, condition: string): string
  abstract searchPattern(expr: string, op: string): string
  abstract aggregateFunction(type: string, expr: string): string
  abstract cteReAggregate(type: string, colExpr: string): string
  abstract transformSql(sql: string): string
}
