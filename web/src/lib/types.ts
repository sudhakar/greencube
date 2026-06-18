export type WidgetType = 'number' | 'gauge' | 'bar' | 'line' | 'area' | 'pie' | 'table' | 'metric'

export interface LayoutItem {
  i: string
  x: number; y: number; w: number; h: number
  minW?: number; minH?: number
}

export interface WidgetInstance {
  id: string
  type: WidgetType
  title: string
  query: object
  config: object
}

export interface Report {
  id: string
  title: string
  widgets: WidgetInstance[]
  layout: LayoutItem[]
  createdAt: number
  updatedAt: number
}

export interface CubeMeta {
  cubes: Cube[]
  samples: { name: string; json: object }[]
  routes: { method: string; path: string; description: string }[]
}

export interface Cube {
  name: string
  measures: Field[]
  dimensions: Field[]
  timeDimensions: Field[]
}

export interface Field {
  name: string
  title: string
  type: string
}

export interface QueryResult {
  data: Record<string, unknown>[]
}
