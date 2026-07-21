/**
 * Shared test schema — re-used by all compiler tests.
 * Defines a minimal 3-cube e-commerce schema.
 */

import { defineCube } from '../GreenCube.ts'
import type { Cube, MeasureType } from '../GreenCube.ts'

/** Build an Orders cube with many measure types. */
export function ordersCube(): Cube {
  const measures: Record<string, any> = {
    count: { sql: 'o.id', type: 'count' as MeasureType },
    count_distinct: { sql: 'o.id', type: 'countDistinct' as MeasureType },
    sum_total: { sql: 'o.total', type: 'sum' as MeasureType },
    avg_total: { sql: 'o.total', type: 'avg' as MeasureType },
    min_total: { sql: 'o.total', type: 'min' as MeasureType },
    max_total: { sql: 'o.total', type: 'max' as MeasureType },
  }

  return defineCube('Orders', {
    sql: 'analytics.orders o',
    dimensions: {
      id: { sql: 'o.id', type: 'number' },
      status: { sql: 'o.status', type: 'string' },
      customer_id: { sql: 'o.customer_id', type: 'number' },
      ordered_at: { sql: 'o.ordered_at', type: 'time' },
    },
    measures,
    joins: {
      customer: {
        targetCube: 'Customers',
        keys: { source: 'o.customer_id', target: 'c.id' },
        relationship: 'belongsTo',
        joinType: 'inner',
      },
      items: {
        targetCube: 'OrderItems',
        keys: { source: 'o.id', target: 'oi.order_id' },
        relationship: 'hasMany',
      },
    },
  })
}

/** Build a Customers cube. */
export function customersCube(): Cube {
  return defineCube('Customers', {
    sql: 'analytics.customers c',
    where: 'c.deleted_at IS NULL',
    dimensions: {
      id: { sql: 'c.id', type: 'number' },
      name: { sql: 'c.name', type: 'string' },
      country: { sql: 'c.country', type: 'string' },
      created_at: { sql: 'c.created_at', type: 'time' },
    },
    measures: {
      count: { sql: 'c.id', type: 'count' },
      countries: { sql: 'c.country', type: 'countDistinct' },
    },
    joins: {
      orders: {
        targetCube: 'Orders',
        keys: { source: 'c.id', target: 'o.customer_id' },
        relationship: 'hasMany',
      },
    },
  })
}

/** Build an OrderItems cube. */
export function orderItemsCube(): Cube {
  return defineCube('OrderItems', {
    sql: 'analytics.order_items oi',
    dimensions: {
      id: { sql: 'oi.id', type: 'number' },
      order_id: { sql: 'oi.order_id', type: 'number' },
      product_name: { sql: 'oi.product_name', type: 'string' },
    },
    measures: {
      revenue: {
        sql: 'oi.quantity * oi.unit_price',
        type: 'sum',
      },
      items_sold: { sql: 'oi.quantity', type: 'sum' },
    },
    joins: {
      order: {
        targetCube: 'Orders',
        keys: { source: 'oi.order_id', target: 'o.id' },
        relationship: 'belongsTo',
        joinType: 'inner',
      },
    },
  })
}

/** Build a cube with a calculated measure. */
export function ordersWithCalcCube(): Cube {
  return defineCube('OrdersCalc', {
    sql: 'analytics.orders o',
    dimensions: {
      id: { sql: 'o.id', type: 'number' },
      status: { sql: 'o.status', type: 'string' },
    },
    measures: {
      count: { sql: 'o.id', type: 'count' },
      count_pct: {
        type: 'calculated',
        calculatedSql: '({OrdersCalc.count} * 100.0) / SUM({OrdersCalc.count}) OVER ()',
      },
    },
  })
}

/** Build a cube with a measure-level filter. */
export function ordersWithFilterCube(): Cube {
  return defineCube('OrdersFiltered', {
    sql: 'analytics.orders o',
    dimensions: {
      id: { sql: 'o.id', type: 'number' },
      status: { sql: 'o.status', type: 'string' },
    },
    measures: {
      count_all: { sql: 'o.id', type: 'count' },
      count_completed: {
        sql: 'o.id',
        type: 'count',
        filters: [() => "o.status = 'completed'"],
      },
    },
  })
}

/** Build a cube with a window function measure. */
export function customersWithWinCube(): Cube {
  return defineCube('CustomersWin', {
    sql: 'analytics.customers c',
    dimensions: {
      id: { sql: 'c.id', type: 'number' },
      name: { sql: 'c.name', type: 'string' },
      country: { sql: 'c.country', type: 'string' },
    },
    measures: {
      count: { sql: 'c.id', type: 'count' },
      rank: {
        type: 'rank',
        windowConfig: {
          partitionBy: ['c.country'],
          orderBy: [{ field: 'c.name', direction: 'asc' }],
        },
      },
    },
  })
}

/** Build a cube with RLS where clause on non-INNER join. */
export function ordersLeftJoinCube(): Cube {
  return defineCube('OrdersLeft', {
    sql: 'analytics.orders o',
    where: 'o.tenant_id = 1',
    dimensions: {
      id: { sql: 'o.id', type: 'number' },
      status: { sql: 'o.status', type: 'string' },
    },
    measures: {
      count: { sql: 'o.id', type: 'count' },
    },
    joins: {
      customer: {
        targetCube: 'CustomersLeft',
        keys: { source: 'o.customer_id', target: 'c.id' },
        relationship: 'belongsTo',
        joinType: 'left',
      },
    },
  })
}

/** Build a cube used as the RHS of a LEFT JOIN with its own RLS. */
export function customersLeftCube(): Cube {
  return defineCube('CustomersLeft', {
    sql: 'analytics.customers c',
    where: 'c.region = \'EMEA\'',
    dimensions: {
      id: { sql: 'c.id', type: 'number' },
      region: { sql: 'c.region', type: 'string' },
    },
    measures: {
      count: { sql: 'c.id', type: 'count' },
    },
  })
}

/** Convenience: build a map from any number of cubes. */
export function cubeMap(...cubes: Cube[]): Map<string, Cube> {
  const m = new Map<string, Cube>()
  for (const c of cubes) m.set(c.name, c)
  return m
}
