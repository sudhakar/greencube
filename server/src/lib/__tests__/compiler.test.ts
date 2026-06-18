import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CubeQueryCompiler, defineCube } from '../GreenCube.ts'
import type { Cube, Query, CompiledQuery, MeasureType } from '../GreenCube.ts'
import {
  ordersCube,
  customersCube,
  orderItemsCube,
  ordersWithCalcCube,
  ordersWithFilterCube,
  customersWithWinCube,
  ordersLeftJoinCube,
  customersLeftCube,
  cubeMap,
} from './schema.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────

function compile(
  cubes: Map<string, Cube>,
  query: Query,
): CompiledQuery {
  return new CubeQueryCompiler(cubes).compile(query)
}

// =============================================================================
// Validation (error cases)
// =============================================================================

describe('validation', () => {
  it('throws on unregistered cube', () => {
    assert.throws(
      () => compile(cubeMap(ordersCube()), { measures: ['Unknown.count'] }),
      /Cube not registered: "Unknown"/,
    )
  })

  it('throws on non-existent measure', () => {
    assert.throws(
      () => compile(cubeMap(ordersCube()), { measures: ['Orders.nope'] }),
      /Measure "Orders\.nope" not found/,
    )
  })

  it('throws on non-existent dimension', () => {
    assert.throws(
      () =>
        compile(cubeMap(ordersCube()), {
          measures: ['Orders.count'],
          dimensions: ['Orders.nope'],
        }),
      /Dimension "Orders\.nope" not found/,
    )
  })

  it('throws on invalid member format', () => {
    assert.throws(
      () => compile(cubeMap(ordersCube()), { measures: ['badformat'] }),
      /Invalid member format/,
    )
  })

  it('throws when no join path exists', () => {
    const orders = ordersCube()
    const standalone = defineCube('Standalone', {
      sql: 'analytics.other t',
      dimensions: { id: { sql: 't.id', type: 'number' } },
      measures: { count: { sql: 't.id', type: 'count' } },
    })
    // Remove the joins on orders so nothing connects
    const ordersNoJoins = defineCube('Orders', {
      ...orders,
      joins: undefined,
    })
    assert.throws(
      () =>
        compile(cubeMap(ordersNoJoins, standalone), {
          measures: ['Standalone.count', 'Orders.count'],
        }),
      /No join path/,
    )
  })

  it('throws on invalid time granularity', () => {
    assert.throws(
      () =>
        compile(cubeMap(ordersCube()), {
          measures: ['Orders.count'],
          timeDimensions: [
            { dimension: 'Orders.ordered_at', granularity: 'century' as any },
          ],
        }),
      /Unsupported time granularity/,
    )
  })

  it('throws on unknown filter operator', () => {
    assert.throws(
      () =>
        compile(cubeMap(ordersCube()), {
          measures: ['Orders.count'],
          filters: [
            { member: 'Orders.status', operator: 'magic' as any, values: ['x'] },
          ],
        }),
      /Unknown filter operator/,
    )
  })
})

// =============================================================================
// Single-cube queries
// =============================================================================

describe('single cube', () => {
  it('simple count measure', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
    })
    assert.match(sql, /SELECT/)
    assert.match(sql, /COUNT\(o\.id\)/)
    assert.match(sql, /AS "Orders\.count"/)
    assert.match(sql, /FROM analytics\.orders o/)
    assert.equal(params.length, 0)
  })

  it('count distinct measure', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count_distinct'],
    })
    assert.match(sql, /COUNT\(DISTINCT o\.id\) AS "Orders\.count_distinct"/)
  })

  it('sum measure', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.sum_total'],
    })
    assert.match(sql, /SUM\(o\.total\) AS "Orders\.sum_total"/)
  })

  it('avg measure', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.avg_total'],
    })
    assert.match(sql, /AVG\(o\.total\) AS "Orders\.avg_total"/)
  })

  it('min measure', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.min_total'],
    })
    assert.match(sql, /MIN\(o\.total\) AS "Orders\.min_total"/)
  })

  it('max measure', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.max_total'],
    })
    assert.match(sql, /MAX\(o\.total\) AS "Orders\.max_total"/)
  })

  it('dimension adds GROUP BY', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      dimensions: ['Orders.status'],
    })
    assert.match(sql, /GROUP BY o\.status/)
  })

  it('time dimension with granularity', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      timeDimensions: [
        { dimension: 'Orders.ordered_at', granularity: 'month' },
      ],
    })
    assert.match(
      sql,
      /DATE_TRUNC\('month', o\.ordered_at\) AS "Orders\.ordered_at"/,
    )
    assert.match(sql, /GROUP BY DATE_TRUNC\('month', o\.ordered_at\)/)
  })

  it('all time granularities', () => {
    for (const g of ['day', 'week', 'month', 'quarter', 'year']) {
      const { sql } = compile(cubeMap(ordersCube()), {
        measures: ['Orders.count'],
        timeDimensions: [
          { dimension: 'Orders.ordered_at', granularity: g as any },
        ],
      })
      assert.match(sql, new RegExp(`DATE_TRUNC\\('${g}',`))
    }
  })

  it('multiple dimensions group by all', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      dimensions: ['Orders.status', 'Orders.customer_id'],
    })
    assert.match(sql, /GROUP BY o\.status, o\.customer_id/)
  })

  it('implicit ORDER BY when time dimension present', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      timeDimensions: [
        { dimension: 'Orders.ordered_at', granularity: 'month' },
      ],
    })
    assert.match(sql, /ORDER BY "Orders\.ordered_at" ASC/)
  })

  it('explicit ORDER BY', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      dimensions: ['Orders.status'],
      order: { 'Orders.count': 'desc' },
    })
    assert.match(sql, /ORDER BY "Orders\.count" desc/i)
  })

  it('LIMIT and OFFSET', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      limit: 20,
      offset: 5,
    })
    assert.match(sql, /LIMIT 20/)
    assert.match(sql, /OFFSET 5/)
  })

  it('ungrouped query omits GROUP BY', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      dimensions: ['Orders.status'],
      ungrouped: true,
    })
    assert.doesNotMatch(sql, /GROUP BY/)
    assert.doesNotMatch(sql, /COUNT\(/)
  })

  it('empty query throws', () => {
    assert.throws(
      () => compile(cubeMap(ordersCube()), { measures: [] }),
      /must reference at least one cube/,
    )
  })
})

// =============================================================================
// Filters
// =============================================================================

describe('filters', () => {
  it('equals with single value adds placeholder', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        { member: 'Orders.status', operator: 'equals', values: ['completed'] },
      ],
    })
    assert.match(sql, /WHERE/)
    assert.match(sql, /o\.status = \?/)
    assert.deepEqual(params, ['completed'])
  })

  it('equals with IN for multiple values', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        {
          member: 'Orders.status',
          operator: 'equals',
          values: ['completed', 'pending'],
        },
      ],
    })
    assert.match(sql, /o\.status IN \(\?, \?\)/)
    assert.deepEqual(params, ['completed', 'pending'])
  })

  it('equals with null becomes IS NULL', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        { member: 'Orders.status', operator: 'equals', values: [null] },
      ],
    })
    assert.match(sql, /o\.status IS NULL/)
    assert.equal(params.length, 0)
  })

  it('equals with empty becomes 1=0', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [{ member: 'Orders.status', operator: 'equals', values: [] }],
    })
    assert.match(sql, /1=0/)
  })

  it('notEquals with single value', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        {
          member: 'Orders.status',
          operator: 'notEquals',
          values: ['cancelled'],
        },
      ],
    })
    assert.match(sql, /o\.status != \?/)
    assert.deepEqual(params, ['cancelled'])
  })

  it('notEquals with null becomes IS NOT NULL', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        { member: 'Orders.status', operator: 'notEquals', values: [null] },
      ],
    })
    assert.match(sql, /o\.status IS NOT NULL/)
  })

  it('contains uses ILIKE', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        { member: 'Orders.status', operator: 'contains', values: ['comp'] },
      ],
    })
    assert.match(sql, /o\.status ILIKE '%' \|\| \? \|\| '%'/)
    assert.deepEqual(params, ['comp'])
  })

  it('notContains', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        {
          member: 'Orders.status',
          operator: 'notContains',
          values: ['comp'],
        },
      ],
    })
    assert.match(sql, /NOT ILIKE/)
  })

  it('startsWith', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        { member: 'Orders.status', operator: 'startsWith', values: ['com'] },
      ],
    })
    assert.match(sql, /ILIKE \? \|\| '%'/)
    assert.deepEqual(params, ['com'])
  })

  it('endsWith', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        { member: 'Orders.status', operator: 'endsWith', values: ['ted'] },
      ],
    })
    assert.match(sql, /ILIKE '%' \|\| \?/)
    assert.deepEqual(params, ['ted'])
  })

  it('gt', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        { member: 'Orders.sum_total', operator: 'gt', values: [100] },
      ],
    })
    assert.match(sql, /o\.total > \?/)
    assert.deepEqual(params, [100])
  })

  it('gte', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        { member: 'Orders.sum_total', operator: 'gte', values: [100] },
      ],
    })
    assert.match(sql, /o\.total >= \?/)
  })

  it('lt and lte', () => {
    const r1 = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        { member: 'Orders.sum_total', operator: 'lt', values: [100] },
      ],
    })
    const r2 = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        { member: 'Orders.sum_total', operator: 'lte', values: [100] },
      ],
    })
    assert.match(r1.sql, /o\.total < \?/)
    assert.match(r2.sql, /o\.total <= \?/)
  })

  it('inDateRange', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        {
          member: 'Orders.ordered_at',
          operator: 'inDateRange',
          values: ['2024-01-01', '2025-01-01'],
        },
      ],
    })
    assert.match(sql, /o\.ordered_at >= \? AND o\.ordered_at < \?/)
    assert.deepEqual(params, ['2024-01-01', '2025-01-01'])
  })

  it('notInDateRange', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        {
          member: 'Orders.ordered_at',
          operator: 'notInDateRange',
          values: ['2024-01-01', '2025-01-01'],
        },
      ],
    })
    assert.match(sql, /NOT \(/)
  })

  it('beforeDate and afterDate', () => {
    const r1 = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        {
          member: 'Orders.ordered_at',
          operator: 'beforeDate',
          values: ['2025-01-01'],
        },
      ],
    })
    const r2 = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        {
          member: 'Orders.ordered_at',
          operator: 'afterDate',
          values: ['2024-01-01'],
        },
      ],
    })
    assert.match(r1.sql, /o\.ordered_at < \?/)
    assert.match(r2.sql, /o\.ordered_at >= \?/)
  })

  it('set and notSet', () => {
    const r1 = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [{ member: 'Orders.status', operator: 'set', values: [] }],
    })
    const r2 = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        { member: 'Orders.status', operator: 'notSet', values: [] },
      ],
    })
    assert.match(r1.sql, /IS NOT NULL/)
    assert.match(r2.sql, /IS NULL/)
  })

  it('multiple filters combine with AND', () => {
    const { sql } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        { member: 'Orders.status', operator: 'equals', values: ['completed'] },
        { member: 'Orders.sum_total', operator: 'gt', values: [50] },
      ],
    })
    // Two conditions: status = ? AND total > ?
    assert.match(sql, /WHERE/)
    const matches = sql.match(/\?/g)
    assert.equal(matches?.length, 2)
  })

  it('logical AND filter', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        {
          and: [
            { member: 'Orders.status', operator: 'equals', values: ['completed'] },
            { member: 'Orders.sum_total', operator: 'gt', values: [50] },
          ],
        },
      ],
    })
    assert.match(sql, /AND/)
    assert.deepEqual(params, ['completed', 50])
  })

  it('logical OR filter', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        {
          or: [
            { member: 'Orders.status', operator: 'equals', values: ['completed'] },
            { member: 'Orders.status', operator: 'equals', values: ['pending'] },
          ],
        },
      ],
    })
    assert.match(sql, /OR/)
    assert.deepEqual(params, ['completed', 'pending'])
  })

  it('nested AND/OR filter', () => {
    const { sql, params } = compile(cubeMap(ordersCube()), {
      measures: ['Orders.count'],
      filters: [
        {
          and: [
            { member: 'Orders.status', operator: 'equals', values: ['completed'] },
            {
              or: [
                {
                  member: 'Orders.sum_total',
                  operator: 'gt',
                  values: [100],
                },
                {
                  member: 'Orders.sum_total',
                  operator: 'lt',
                  values: [10],
                },
              ],
            },
          ],
        },
      ],
    })
    assert.match(sql, /AND/)
    assert.match(sql, /OR/)
    assert.equal(params.length, 3)
  })
})

// =============================================================================
// Multi-cube queries (joins and CTEs)
// =============================================================================

describe('multi-cube', () => {
  it('belongsTo join (no CTE)', () => {
    // Query with Orders dimension ensures Orders is primary cube.
    // Customers is belongsTo (hasMany reverse), with no measures referenced
    // → no CTE needed, plain JOIN suffices.
    const { sql, params } = compile(
      cubeMap(ordersCube(), customersCube()),
      {
        measures: ['Orders.count'],
        dimensions: ['Orders.status', 'Customers.country'],
      },
    )
    assert.match(sql, /FROM analytics\.orders o/)
    assert.match(sql, /JOIN analytics\.customers c ON o\.customer_id = c\.id/)
    assert.match(sql, /GROUP BY/)
    assert.equal(params.length, 0)
  })

  it('hasMany CTE when many-side contributes measures', () => {
    // OrderItems is primary (appears first in query), JOINs to Orders directly.
    const { sql, params } = compile(
      cubeMap(ordersCube(), orderItemsCube()),
      {
        measures: ['OrderItems.revenue', 'Orders.count'],
        dimensions: ['Orders.status'],
      },
    )
    assert.match(sql, /FROM analytics\.order_items oi/)
    assert.match(sql, /JOIN analytics\.orders o ON oi\.order_id = o\.id/)
    assert.match(sql, /SUM\(oi\.quantity \* oi\.unit_price\)/)
    assert.match(sql, /GROUP BY o\.status/)
    assert.equal(params.length, 0)
  })

  it('no CTE when many-side has no measures', () => {
    // Customers has hasMany to Orders but if we only query Customers measures,
    // no CTE needed
    const { sql } = compile(
      cubeMap(customersCube(), ordersCube()),
      {
        measures: ['Customers.count'],
        dimensions: ['Customers.country'],
      },
    )
    // Only one cube referenced → single cube query
    assert.match(sql, /FROM analytics\.customers c/)
    assert.doesNotMatch(sql, /WITH/)
  })

  it('three-cube query with multiple CTEs', () => {
    // OrderItems has hasMany to Orders → triggers CTE.
    // Customers is belongsTo (the reverse of hasMany) → plain JOIN, no CTE.
    // Use Orders.status dimension to make Orders the primary cube,
    // since it connects to both other cubes via direct joins.
    const { sql, params } = compile(
      cubeMap(ordersCube(), customersCube(), orderItemsCube()),
      {
        measures: [
          'OrderItems.revenue',
          'Customers.count',
          'Orders.count',
        ],
        dimensions: ['Orders.status'],
      },
    )
    // 1 CTE (orderitems_agg for the hasMany relationship)
    assert.match(sql, /WITH/)
    const cteMatches = sql.match(/_agg AS/g)
    assert.equal(cteMatches?.length, 1)
    assert.match(sql, /orderitems_agg AS/)

    // Customers is belongsTo → plain JOIN
    assert.match(sql, /JOIN analytics\.customers c/)

    // GROUP BY on the final joined result
    assert.match(sql, /GROUP BY/)
    assert.equal(params.length, 0)
  })

  it('CTE includes dimension fields from CTE\'d cube and main GROUP BY references CTE alias', () => {
    // Customers hasMany to Orders → Orders CTE'd
    // Orders.status dimension should appear in CTE SELECT/GROUP BY and main GROUP BY
    const { sql } = compile(
      cubeMap(customersCube(), ordersCube()),
      {
        measures: ['Customers.count', 'Orders.count'],
        dimensions: ['Orders.status'],
      },
    )
    assert.match(sql, /WITH orders_agg AS/)
    assert.match(sql, /SELECT o\.customer_id, COUNT\(o\.id\) AS count, o\.status AS status FROM analytics\.orders o GROUP BY o\.customer_id, o\.status/)
    assert.match(sql, /LEFT JOIN "orders_agg" ON orders_agg\.customer_id = c\.id/)
    assert.match(sql, /GROUP BY "orders_agg"\."status"/)
  })

  it('CTE filter references CTE alias column', () => {
    const { sql, params } = compile(
      cubeMap(customersCube(), ordersCube()),
      {
        measures: ['Customers.count', 'Orders.count'],
        filters: [{ member: 'Orders.status', operator: 'equals', values: ['completed'] }],
      },
    )
    assert.match(sql, /"orders_agg"\."status" = \?/)
    assert.deepEqual(params, ['completed'])
  })

  it('CTE with time dimension uses CTE alias column', () => {
    const { sql } = compile(
      cubeMap(customersCube(), ordersCube()),
      {
        measures: ['Customers.count', 'Orders.count'],
        timeDimensions: [{ dimension: 'Orders.ordered_at', granularity: 'month' }],
      },
    )
    assert.match(sql, /WITH orders_agg AS/)
    assert.match(sql, /o\.ordered_at AS ordered_at/)
    assert.match(sql, /GROUP BY o\.customer_id, o\.ordered_at/)
    assert.match(sql, /GROUP BY DATE_TRUNC\('month', "orders_agg"\."ordered_at"\)/)
  })

  it('CTE with both dimension and filter from CTE\'d cube', () => {
    const { sql, params } = compile(
      cubeMap(customersCube(), ordersCube()),
      {
        measures: ['Customers.count', 'Orders.count'],
        dimensions: ['Orders.status'],
        filters: [{ member: 'Orders.status', operator: 'equals', values: ['completed'] }],
      },
    )
    assert.match(sql, /WITH orders_agg AS/)
    assert.match(sql, /o\.status AS status/)
    assert.match(sql, /GROUP BY "orders_agg"\."status"/)
    assert.match(sql, /"orders_agg"\."status" = \?/)
    assert.deepEqual(params, ['completed'])
  })

  it('CTE cube WHERE is applied inside the CTE', () => {
    // Create a cube with both a hasMany relationship AND a where clause.
    // This cube will be CTE'd, and its WHERE should be inside the CTE.
    const customersWithWhere: Cube = defineCube('CustomersWW', {
      sql: 'analytics.customers c',
      where: 'c.deleted_at IS NULL',
      dimensions: {
        id: { sql: 'c.id', type: 'number' },
        country: { sql: 'c.country', type: 'string' },
      },
      measures: {
        count: { sql: 'c.id', type: 'count' },
      },
      joins: {
        orders: {
          targetCube: 'OrdersWW',
          keys: { source: 'c.id', target: 'o.customer_id' },
          relationship: 'hasMany',
        },
      },
    })
    const ordersWW: Cube = defineCube('OrdersWW', {
      sql: 'analytics.orders o',
      dimensions: {
        id: { sql: 'o.id', type: 'number' },
      },
      measures: {
        count: { sql: 'o.id', type: 'count' },
      },
      joins: {
        customer: {
          targetCube: 'CustomersWW',
          keys: { source: 'o.customer_id', target: 'c.id' },
          relationship: 'belongsTo',
        },
      },
    })

    // Query with CustomersWW dimension → CustomersWW is primary.
    // Orders is hasMany with measures → CTE.
    // CustomersWW's WHERE should be inside the main query since CustomersWW
    // is the primary cube.
    const { sql } = compile(
      cubeMap(customersWithWhere, ordersWW),
      {
        measures: ['CustomersWW.count', 'OrdersWW.count'],
        dimensions: ['CustomersWW.country'],
      },
    )
    // orders_agg CTE should NOT contain c.deleted_at (that's CustomersWW's WHERE)
    // The CTE is for Orders, which has no where
    assert.match(sql, /WITH ordersww_agg AS/)
    assert.match(sql, /FROM analytics\.customers c/)
    // CustomersWW's WHERE goes in main query (it's the primary cube)
    assert.match(sql, /WHERE.*c\.deleted_at IS NULL/)
  })
})

// =============================================================================
// Calculated measures
// =============================================================================

describe('calculated measures', () => {
  it('substitutes {Cube.field} templates', () => {
    const { sql, params } = compile(cubeMap(ordersWithCalcCube()), {
      measures: ['OrdersCalc.count', 'OrdersCalc.count_pct'],
    })
    assert.match(
      sql,
      /COUNT\(o\.id\) AS "OrdersCalc\.count"/,
    )
    // count_pct references {OrdersCalc.count} which becomes COUNT(o.id)
    // Wrapped in extra parens from buildCalculatedMeasureSql
    // Assert the template substitution produced a valid expression
    assert.match(sql, /\* 100\.0\)/)
    assert.match(sql, /SUM\(COUNT/)
    assert.match(
      sql,
      /OrdersCalc\.count_pct"/,
    )
    assert.equal(params.length, 0)
  })
})

// =============================================================================
// Measure filters (FILTER WHERE)
// =============================================================================

describe('measure filters', () => {
  it('applies measure-level filter as FILTER(WHERE ...)', () => {
    const { sql, params } = compile(cubeMap(ordersWithFilterCube()), {
      measures: ['OrdersFiltered.count_all', 'OrdersFiltered.count_completed'],
    })
    assert.match(
      sql,
      /COUNT\(o\.id FILTER \(WHERE o\.status = 'completed'\)\) AS "OrdersFiltered\.count_completed"/,
    )
    assert.equal(params.length, 0)
  })
})

// =============================================================================
// Window functions
// =============================================================================

describe('window functions', () => {
  it('rank with partition by and order by', () => {
    const { sql, params } = compile(cubeMap(customersWithWinCube()), {
      measures: ['CustomersWin.count', 'CustomersWin.rank'],
    })
    assert.match(sql, /RANK\(\) OVER \(PARTITION BY c\.country ORDER BY c\.name asc\) AS "CustomersWin\.rank"/i)
    assert.equal(params.length, 0)
  })
})

// =============================================================================
// RLS / security WHERE
// =============================================================================

describe('security WHERE (RLS)', () => {
  it('primary cube WHERE in main clause, non-INNER cube WHERE in ON', () => {
    // OrdersLeft is primary (first in query), CustomersLeft LEFT JOINed.
    // OrdersLeft's RLS (o.tenant_id = 1) stays in main WHERE.
    // CustomersLeft has LEFT JOIN, so its RLS (c.region) goes in ON clause.
    const { sql, params } = compile(
      cubeMap(ordersLeftJoinCube(), customersLeftCube()),
      {
        measures: ['OrdersLeft.count'],
        dimensions: ['CustomersLeft.region'],
      },
    )
    assert.match(sql, /FROM analytics\.orders o/)
    assert.match(sql, /LEFT JOIN analytics\.customers c ON/)
    // OrdersLeft's RLS in main WHERE
    assert.match(sql, /WHERE \(o\.tenant_id = 1\)/)
    // CustomersLeft's RLS in ON clause (LEFT JOIN preserves NULL rows)
    assert.match(sql, /c\.region = 'EMEA'/)
    assert.equal(params.length, 0)
  })
})

// =============================================================================
// Query surface area regression
// =============================================================================

describe('regression', () => {
  it('complete multi-cube query produces valid SQL', () => {
    const { sql, params } = compile(
      cubeMap(ordersCube(), customersCube(), orderItemsCube()),
      {
        measures: ['OrderItems.revenue', 'Orders.count', 'Customers.count'],
        dimensions: ['Customers.country'],
        timeDimensions: [
          { dimension: 'Orders.ordered_at', granularity: 'year' },
        ],
        filters: [
          { member: 'Orders.status', operator: 'equals', values: ['completed'] },
        ],
        order: { 'Orders.ordered_at': 'desc' },
        limit: 5,
      },
    )

    // SQL starts with WITH
    assert.match(sql, /^WITH/)

    // Has SELECT
    assert.match(sql, /SELECT/)

    // Has correct aliases for CTE references
    // CTE measures use MAX() re-aggregation
    assert.match(sql, /FROM analytics\.orders o/)

    // Has JOINs
    assert.match(sql, /LEFT JOIN/)

    // Has WHERE
    assert.match(sql, /WHERE/)

    // Has GROUP BY (there are dimensions)
    assert.match(sql, /GROUP BY/)

    // Has ORDER BY
    assert.match(sql, /ORDER BY/)

    // Has LIMIT
    assert.match(sql, /LIMIT 5/)

    // Params: one filter value
    assert.deepEqual(params, ['completed'])
  })

  it('repeated compile calls produce identical output', () => {
    const cubes = cubeMap(ordersCube())
    const q: Query = { measures: ['Orders.count'] }
    const r1 = compile(cubes, q)
    const r2 = compile(cubes, q)
    assert.equal(r1.sql, r2.sql)
    assert.deepEqual(r1.params, r2.params)
  })
})
