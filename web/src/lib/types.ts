export type { CubeMeta, Cube, Field, QueryResult } from './cube/types'

import { type LayoutItem } from 'react-grid-layout'

export type WidgetType = 'number' | 'bar' | 'line' | 'area' | 'pie' | 'table'

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
