/**
 * GreenCube Demo — E-commerce Cube Definitions
 *
 * Schema:
 *   customers    (id, name, country, created_at)
 *   orders       (id, customer_id, ordered_at, status)
 *   order_items  (id, order_id, product_id, product_name, quantity, unit_price)
 *   products     (id, name, category, supplier_id, price)
 *   suppliers    (id, name, country, tier, contract_signed_at)
 *   shipments    (id, order_id, carrier, shipped_at, delivered_at, shipping_cost, warehouse_city)
 *
 * Relationships:
 *   Customers.orders     → Orders      (hasMany)
 *   Orders.customer      → Customers   (belongsTo, inner)
 *   Orders.order_items   → OrderItems  (hasMany)
 *   OrderItems.product   → Products    (belongsTo, inner)
 *   Products.supplier    → Suppliers   (belongsTo)
 *   Products.order_items → OrderItems  (hasMany)
 *   Suppliers.products   → Products    (hasMany)
 *   Shipments.order      → Orders      (belongsTo, left)
 */

import type { Cube } from '../GreenCube.ts'
import { defineCube } from '../GreenCube.ts'

export const customers = defineCube('Customers', {
  sql: 'analytics.customers c',
  where: 'c.deleted_at IS NULL',
  sampleQueries: [
    'customer count and order count by country, top 10',
    'customers without country, count by country',
  ],
  dimensions: {
    id: { sql: 'c.id', type: 'number' },
    name: { sql: 'c.name', type: 'string' },
    country: { sql: 'c.country', type: 'string' },
    isActive: { sql: 'c.active', type: 'boolean' },
    created_at: { sql: 'c.created_at', type: 'time' },
  },
  measures: {
    count: { sql: 'c.id', type: 'count', title: 'Customers' },
    countries: { sql: 'c.country', type: 'countDistinct', title: 'Countries' },
  },
  joins: {
    orders: {
      targetCube: 'Orders',
      keys: { source: 'c.id', target: 'o.customer_id' },
      relationship: 'hasMany',
    },
  },
})

export const orders = defineCube('Orders', {
  sql: 'analytics.orders o',
  sampleQueries: [
    'total orders and completed orders, top 5 by status',
    'monthly order count per month, last 6 months',
  ],
  dimensions: {
    id: { sql: 'o.id', type: 'number' },
    customer_id: { sql: 'o.customer_id', type: 'number' },
    status: { sql: 'o.status', type: 'string' },
    ordered_at: { sql: 'o.ordered_at', type: 'time' },
  },
  measures: {
    count: { sql: 'o.id', type: 'count', title: 'Orders' },
    count_completed: {
      sql: 'o.id',
      type: 'count',
      title: 'Completed Orders',
      filters: [() => "o.status = 'completed'"],
    },
    count_pct: {
      type: 'calculated',
      title: '% of Total Orders',
      calculatedSql: '({Orders.count} * 100.0) / SUM({Orders.count}) OVER ()',
    },
  },
  joins: {
    customer: {
      targetCube: 'Customers',
      keys: { source: 'o.customer_id', target: 'c.id' },
      relationship: 'belongsTo',
      joinType: 'inner',
    },
    order_items: {
      targetCube: 'OrderItems',
      keys: { source: 'o.id', target: 'oi.order_id' },
      relationship: 'hasMany',
    },
  },
})

export const orderItems = defineCube('OrderItems', {
  sql: 'analytics.order_items oi',
  sampleQueries: [
    'total revenue and items sold, top 5 by product name',
    'total, average, median, p95 and stddev revenue by product name, top 5',
    'revenue and items sold, top 10',
  ],
  dimensions: {
    id: { sql: 'oi.id', type: 'number' },
    order_id: { sql: 'oi.order_id', type: 'number' },
    product_id: { sql: 'oi.product_id', type: 'number' },
    product_name: { sql: 'oi.product_name', type: 'string' },
    quantity: { sql: 'oi.quantity', type: 'number' },
    unit_price: { sql: 'oi.unit_price', type: 'number' },
  },
  measures: {
    items_sold: { sql: 'oi.quantity', type: 'sum', title: 'Items Sold' },
    revenue: {
      sql: 'oi.quantity * oi.unit_price',
      type: 'sum',
      title: 'Revenue',
    },
    revenue_avg: {
      sql: 'oi.quantity * oi.unit_price',
      type: 'avg',
      title: 'Avg Revenue per Item',
    },
    revenue_stddev: {
      sql: 'oi.quantity * oi.unit_price',
      type: 'stddev',
      title: 'Revenue Std Dev',
    },
    revenue_median: {
      sql: 'oi.quantity * oi.unit_price',
      type: 'median',
      title: 'Revenue Median',
    },
    revenue_p95: {
      sql: 'oi.quantity * oi.unit_price',
      type: 'p95',
      title: 'Revenue p95',
    },
  },
  joins: {
    order: {
      targetCube: 'Orders',
      keys: { source: 'oi.order_id', target: 'o.id' },
      relationship: 'belongsTo',
      joinType: 'inner',
    },
    product: {
      targetCube: 'Products',
      keys: { source: 'oi.product_id', target: 'p.id' },
      relationship: 'belongsTo',
      joinType: 'inner',
    },
  },
})

export const products = defineCube('Products', {
  sql: 'analytics.products p',
  where: 'p.is_active = TRUE',
  sampleQueries: [
    'product count and distinct categories by category, top 10',
    'products starting with Organic, count by category',
    'product count and revenue by category, top 5',
  ],
  dimensions: {
    id: { sql: 'p.id', type: 'number' },
    name: { sql: 'p.name', type: 'string' },
    category: { sql: 'p.category', type: 'string' },
    supplier_id: { sql: 'p.supplier_id', type: 'number' },
    created_at: { sql: 'p.created_at', type: 'time' },
  },
  measures: {
    count: { sql: 'p.id', type: 'count', title: 'Products' },
    avg_price: { sql: 'p.price', type: 'avg', title: 'Avg Price' },
    max_price: { sql: 'p.price', type: 'max', title: 'Max Price' },
    distinct_categories: {
      sql: 'p.category',
      type: 'countDistinct',
      title: 'Categories',
    },
  },
  joins: {
    supplier: {
      targetCube: 'Suppliers',
      keys: { source: 'p.supplier_id', target: 's.id' },
      relationship: 'belongsTo',
    },
    order_items: {
      targetCube: 'OrderItems',
      keys: { source: 'p.id', target: 'oi.product_id' },
      relationship: 'hasMany',
    },
  },
})

export const suppliers = defineCube('Suppliers', {
  sql: 'analytics.suppliers s',
  where: 's.is_active = TRUE',
  sampleQueries: [
    'supplier count and distinct countries by tier, top 5',
    'supplier and product count by tier, top 10',
  ],
  dimensions: {
    id: { sql: 's.id', type: 'number' },
    name: { sql: 's.name', type: 'string' },
    country: { sql: 's.country', type: 'string' },
    tier: {
      sql: 's.tier',
      type: 'string',
      title: 'Supplier Tier',
    },
    contract_signed_at: { sql: 's.contract_signed_at', type: 'time' },
  },
  measures: {
    count: { sql: 's.id', type: 'count', title: 'Suppliers' },
    distinct_countries: {
      sql: 's.country',
      type: 'countDistinct',
      title: 'Supplier Countries',
    },
  },
  joins: {
    products: {
      targetCube: 'Products',
      keys: { source: 's.id', target: 'p.supplier_id' },
      relationship: 'hasMany',
    },
  },
})

export const shipments = defineCube('Shipments', {
  sql: 'analytics.shipments sh',
  sampleQueries: [
    'shipment count, total shipping cost and distinct carriers, top 5 by carrier',
    'monthly shipment count per month, last 3 months',
    'shipment count by carrier and warehouse city, top 10',
  ],
  dimensions: {
    id: { sql: 'sh.id', type: 'number' },
    order_id: { sql: 'sh.order_id', type: 'number' },
    carrier: { sql: 'sh.carrier', type: 'string' },
    tracking_number: { sql: 'sh.tracking_number', type: 'string' },
    shipped_at: { sql: 'sh.shipped_at', type: 'time' },
    delivered_at: { sql: 'sh.delivered_at', type: 'time' },
    warehouse_city: { sql: 'sh.warehouse_city', type: 'string' },
  },
  measures: {
    count: { sql: 'sh.id', type: 'count', title: 'Shipments' },
    total_shipping_cost: {
      sql: 'sh.shipping_cost',
      type: 'sum',
      title: 'Shipping Cost',
    },
    avg_delivery_days: {
      sql: "DATEDIFF('day', sh.shipped_at, sh.delivered_at)",
      type: 'avg',
      title: 'Avg Delivery Days',
    },
    max_delivery_days: {
      sql: "DATEDIFF('day', sh.shipped_at, sh.delivered_at)",
      type: 'max',
      title: 'Max Delivery Days',
    },
    distinct_carriers: {
      sql: 'sh.carrier',
      type: 'countDistinct',
      title: 'Carriers',
    },
  },
  joins: {
    order: {
      targetCube: 'Orders',
      keys: { source: 'sh.order_id', target: 'o.id' },
      relationship: 'belongsTo',
      joinType: 'left',
    },
  },
})

// =============================================================================
// Direct execution — compiles and prints example queries to stdout
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const { CubeQueryCompiler } = await import('../GreenCube.ts')

  const cubes = new Map<string, Cube>()
  for (const c of [customers, orders, orderItems, products, suppliers, shipments]) {
    cubes.set(c.name, c)
  }

  const compiler = new CubeQueryCompiler(cubes)

  function show(label: string, query: Record<string, unknown>): void {
    try {
      const { sql, params } = compiler.compile(query as any)
      console.log(`\n// ${'─'.repeat(60)}`)
      console.log(`// ${label}`)
      console.log(`// ${'─'.repeat(60)}`)
      console.log(sql)
      if (params.length > 0) {
        console.log(`\n-- binds: ${JSON.stringify(params)}`)
      }
    } catch (e: any) {
      console.log(`\n// ${'─'.repeat(60)}`)
      console.log(`// ERROR: ${label}`)
      console.log(`// ${'─'.repeat(60)}`)
      console.log(e.message)
    }
  }

  show('Monthly revenue by status (single cube)', {
    measures: ['OrderItems.revenue', 'OrderItems.items_sold'],
    timeDimensions: [{ dimension: 'Orders.ordered_at', granularity: 'month' }],
    dimensions: ['Orders.status'],
    filters: [
      { member: 'Orders.status', operator: 'equals', values: ['completed'] },
      { member: 'Orders.ordered_at', operator: 'afterDate', values: ['2024-01-01'] },
    ],
    order: { 'Orders.ordered_at': 'desc' },
    limit: 12,
  })

  show('Order count with calculated percentage', {
    measures: ['Orders.count', 'Orders.count_pct'],
    dimensions: ['Customers.country'],
    order: { 'Orders.count': 'desc' },
  })

  show('3-table star: Products → OrderItems (CTE) + Products → Suppliers', {
    measures: ['OrderItems.revenue', 'OrderItems.items_sold', 'Suppliers.count'],
    dimensions: ['Products.category', 'Products.name', 'Suppliers.tier'],
    filters: [{ member: 'Suppliers.tier', operator: 'equals', values: ['premium'] }],
    order: { 'OrderItems.revenue': 'desc' },
    limit: 10,
  })

  show('3-table join with time grain (quarterly, by category + tier)', {
    measures: ['OrderItems.revenue', 'Suppliers.count', 'Products.avg_price'],
    dimensions: ['Products.category', 'Suppliers.tier'],
    timeDimensions: [{ dimension: 'Products.created_at', granularity: 'quarter' }],
    filters: [{ member: 'Products.created_at', operator: 'afterDate', values: ['2023-01-01'] }],
    order: { 'Products.created_at': 'asc' },
    limit: 20,
  })

  show('Shipment carrier analysis with order status filter', {
    measures: ['Shipments.count', 'Shipments.total_shipping_cost', 'Shipments.avg_delivery_days', 'Shipments.max_delivery_days', 'Shipments.distinct_carriers'],
    dimensions: ['Shipments.carrier', 'Shipments.warehouse_city'],
    timeDimensions: [{ dimension: 'Shipments.shipped_at', granularity: 'month' }],
    filters: [{ member: 'Shipments.shipped_at', operator: 'afterDate', values: ['2024-06-01'] }],
    order: { 'Shipments.shipped_at': 'desc' },
    limit: 12,
  })

  show('Shipments with order dimensions (LEFT JOIN carrier + status)', {
    measures: ['Shipments.count', 'Shipments.total_shipping_cost', 'Shipments.avg_delivery_days'],
    dimensions: ['Shipments.carrier', 'Orders.status', 'Shipments.warehouse_city'],
    filters: [{ member: 'Shipments.shipped_at', operator: 'afterDate', values: ['2024-01-01'] }],
    order: { 'Shipments.total_shipping_cost': 'desc' },
    limit: 10,
  })

  show('Supplier tier: product count and avg price by tier', {
    measures: ['Suppliers.count', 'Suppliers.distinct_countries', 'Products.count', 'Products.avg_price', 'Products.distinct_categories'],
    dimensions: ['Suppliers.tier'],
    order: { 'Suppliers.count': 'desc' },
  })

  show('Logical AND/OR filters', {
    measures: ['Orders.count', 'OrderItems.revenue'],
    timeDimensions: [{ dimension: 'Orders.ordered_at', granularity: 'month' }],
    filters: [{
      and: [
        { member: 'Orders.status', operator: 'equals', values: ['completed'] },
        {
          or: [
            { member: 'Customers.country', operator: 'equals', values: ['US'] },
            { member: 'Customers.country', operator: 'equals', values: ['DE'] },
          ]
        },
      ],
    }],
    order: { 'Orders.ordered_at': 'desc' },
    limit: 12,
  })

  show('Ungrouped — raw order line items', {
    measures: ['OrderItems.revenue'],
    dimensions: ['OrderItems.product_name'],
    order: { 'OrderItems.product_name': 'asc' },
    limit: 20,
    ungrouped: true,
  })

  show('ILIKE text search on product name', {
    measures: ['OrderItems.items_sold', 'OrderItems.revenue'],
    dimensions: ['OrderItems.product_name'],
    filters: [{ member: 'OrderItems.product_name', operator: 'contains', values: ['organic'] }],
    order: { 'OrderItems.revenue': 'desc' },
    limit: 10,
  })

  show('Date range with stats (avg, median, p95, stddev)', {
    measures: ['OrderItems.revenue', 'OrderItems.revenue_avg', 'OrderItems.revenue_median', 'OrderItems.revenue_p95', 'OrderItems.revenue_stddev', 'Orders.count', 'Customers.countries'],
    dimensions: ['Customers.country'],
    filters: [{ member: 'Orders.ordered_at', operator: 'inDateRange', values: ['2024-01-01', '2025-01-01'] }],
    order: { 'OrderItems.revenue': 'desc' },
  })

  show('Filter: customers without a country set', {
    measures: ['Orders.count'],
    dimensions: ['Customers.country'],
    filters: [{ member: 'Customers.country', operator: 'notSet', values: [] }],
  })

  show('Weekly aggregation', {
    measures: ['OrderItems.revenue', 'Orders.count'],
    timeDimensions: [{ dimension: 'Orders.ordered_at', granularity: 'week' }],
    order: { 'Orders.ordered_at': 'desc' },
    limit: 8,
  })

  show('Yearly product category analysis with supplier tier', {
    measures: ['OrderItems.revenue', 'Products.count', 'Suppliers.count'],
    dimensions: ['Products.category', 'Suppliers.tier'],
    timeDimensions: [{ dimension: 'Products.created_at', granularity: 'year' }],
    order: { 'OrderItems.revenue': 'desc' },
    limit: 25,
  })

  show('Supplier search: "tech" suppliers by tier', {
    measures: ['Suppliers.count', 'Products.count', 'Products.avg_price'],
    dimensions: ['Suppliers.tier', 'Suppliers.country'],
    filters: [
      { member: 'Suppliers.name', operator: 'contains', values: ['Tech'] },
      {
        or: [
          { member: 'Suppliers.tier', operator: 'equals', values: ['premium'] },
          { member: 'Suppliers.tier', operator: 'equals', values: ['standard'] },
        ]
      },
    ],
    order: { 'Suppliers.count': 'desc' },
  })

  show('Delivery performance by warehouse city', {
    measures: ['Shipments.count', 'Shipments.avg_delivery_days', 'Shipments.max_delivery_days', 'Shipments.total_shipping_cost'],
    dimensions: ['Shipments.warehouse_city', 'Shipments.carrier'],
    order: { 'Shipments.avg_delivery_days': 'desc' },
    limit: 15,
  })

  show('Most expensive product categories by avg price', {
    measures: ['Products.count', 'Products.avg_price', 'Products.max_price'],
    dimensions: ['Products.category'],
    order: { 'Products.avg_price': 'desc' },
    limit: 10,
  })
}
