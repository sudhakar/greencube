import type Database from 'better-sqlite3'

export function seed(db: Database.Database): void {
  db.exec("ATTACH DATABASE ':memory:' AS analytics")

  db.exec(`CREATE TABLE analytics.customers (
    id INTEGER PRIMARY KEY, name TEXT, country TEXT,
    created_at TEXT, deleted_at TEXT NULL, active INTEGER DEFAULT 1
  )`)

  db.exec(`CREATE TABLE analytics.orders (
    id INTEGER PRIMARY KEY, customer_id INTEGER,
    status TEXT, ordered_at TEXT
  )`)

  db.exec(`CREATE TABLE analytics.order_items (
    id INTEGER, order_id INTEGER, product_id INTEGER,
    product_name TEXT, quantity REAL, unit_price REAL
  )`)

  db.exec(`CREATE TABLE analytics.products (
    id INTEGER PRIMARY KEY, name TEXT, category TEXT,
    supplier_id INTEGER, price REAL, created_at TEXT, is_active INTEGER
  )`)

  db.exec(`CREATE TABLE analytics.suppliers (
    id INTEGER PRIMARY KEY, name TEXT, country TEXT,
    tier TEXT, contract_signed_at TEXT, is_active INTEGER
  )`)

  db.exec(`CREATE TABLE analytics.shipments (
    id INTEGER PRIMARY KEY, order_id INTEGER, carrier TEXT,
    tracking_number TEXT, shipped_at TEXT, delivered_at TEXT NULL,
    shipping_cost REAL, warehouse_city TEXT
  )`)

  // ── Customers ──────────────────────────────────────────────────────────────
  // 2 deleted (filtered out by cube WHERE), 1 without country (for notSet test)
  const customers = [
    [1, 'Alice', 'US', '2023-01-15', null],
    [2, 'Bob', 'US', '2023-03-20', null],
    [3, 'Carlos', 'MX', '2023-06-10', null],
    [4, 'Diana', 'DE', '2023-09-05', null],
    [5, 'Elena', null, '2024-01-01', null],
    [6, 'Frank', 'US', '2024-02-14', '2024-12-31'],
    [7, 'Grace', 'DE', '2024-04-01', null],
    [8, 'Hans', 'DE', '2024-07-20', '2025-01-15'],
  ]
  const insC = db.prepare('INSERT INTO analytics.customers (id, name, country, created_at, deleted_at) VALUES (?, ?, ?, ?, ?)')
  for (const r of customers) insC.run(...r)

  // ── Orders ─────────────────────────────────────────────────────────────────
  // Various statuses and dates spanning 2023-2025
  const orders = [
    [1, 1,  'completed',  '2023-06-15'],
    [2, 1,  'completed',  '2023-09-20'],
    [3, 2,  'completed',  '2024-01-10'],
    [4, 2,  'shipped',    '2024-03-05'],
    [5, 3,  'completed',  '2024-04-15'],
    [6, 3,  'completed',  '2024-06-01'],
    [7, 4,  'completed',  '2024-07-12'],
    [8, 4,  'processing', '2024-09-01'],
    [9, 5,  'completed',  '2024-10-20'],
    [10, 5, 'cancelled',  '2024-11-05'],
    [11, 7, 'completed',  '2025-01-15'],
    [12, 7, 'shipped',    '2025-02-28'],
    [13, 8, 'processing', '2025-03-10'],
    [14, 6, 'cancelled',  '2024-05-01'],
  ]
  const insO = db.prepare('INSERT INTO analytics.orders VALUES (?, ?, ?, ?)')
  for (const r of orders) insO.run(...r)

  // ── Order Items ────────────────────────────────────────────────────────────
  // ~30 line items across orders
  const items = [
    [1,  1, 1, 'Organic Coffee Beans', 2.0, 15.99],
    [2,  1, 2, 'Green Tea Selection', 1.0, 12.50],
    [3,  1, 3, 'Bamboo Cutting Board', 1.0, 24.99],
    [4,  2, 4, 'Merino Wool Socks', 3.0, 18.00],
    [5,  2, 5, 'Stainless Bottle', 1.0, 32.00],
    [6,  3, 1, 'Organic Coffee Beans', 3.0, 15.99],
    [7,  3, 6, 'Ceramic Mug Set', 2.0, 28.00],
    [8,  3, 7, 'Linen Napkins', 4.0, 8.50],
    [9,  4, 2, 'Green Tea Selection', 2.0, 12.50],
    [10, 4, 8, 'LED Desk Lamp', 1.0, 45.00],
    [11, 5, 3, 'Bamboo Cutting Board', 2.0, 24.99],
    [12, 5, 4, 'Merino Wool Socks', 2.0, 18.00],
    [13, 5, 6, 'Ceramic Mug Set', 1.0, 28.00],
    [14, 6, 1, 'Organic Coffee Beans', 4.0, 15.99],
    [15, 6, 7, 'Linen Napkins', 6.0, 8.50],
    [16, 7, 5, 'Stainless Bottle', 2.0, 32.00],
    [17, 7, 8, 'LED Desk Lamp', 1.0, 45.00],
    [18, 8, 2, 'Green Tea Selection', 3.0, 12.50],
    [19, 8, 4, 'Merino Wool Socks', 1.0, 18.00],
    [20, 9, 1, 'Organic Coffee Beans', 2.0, 15.99],
    [21, 9, 6, 'Ceramic Mug Set', 2.0, 28.00],
    [22, 10, 8, 'LED Desk Lamp', 2.0, 45.00],
    [23, 11, 3, 'Bamboo Cutting Board', 1.0, 24.99],
    [24, 11, 5, 'Stainless Bottle', 1.0, 32.00],
    [25, 12, 7, 'Linen Napkins', 3.0, 8.50],
    [26, 12, 1, 'Organic Coffee Beans', 2.0, 15.99],
    [27, 13, 6, 'Ceramic Mug Set', 3.0, 28.00],
    [28, 14, 2, 'Green Tea Selection', 1.0, 12.50],
  ]
  const insI = db.prepare('INSERT INTO analytics.order_items VALUES (?, ?, ?, ?, ?, ?)')
  for (const r of items) insI.run(...r)

  // ── Products ───────────────────────────────────────────────────────────────
  // Categories: Beverage, Kitchen, Apparel, Accessories, Home
  // Some inactive (filtered out by cube WHERE)
  const products = [
    [1, 'Organic Coffee Beans', 'Beverage', 1, 15.99, '2023-01-01', 1],
    [2, 'Green Tea Selection', 'Beverage', 1, 12.50, '2023-02-01', 1],
    [3, 'Bamboo Cutting Board', 'Kitchen', 2, 24.99, '2023-03-01', 1],
    [4, 'Merino Wool Socks', 'Apparel', 3, 18.00, '2023-04-01', 1],
    [5, 'Stainless Water Bottle', 'Accessories', 2, 32.00, '2023-05-01', 1],
    [6, 'Ceramic Mug Set', 'Kitchen', 2, 28.00, '2023-06-01', 1],
    [7, 'Linen Napkins', 'Home', 4, 8.50, '2023-07-01', 1],
    [8, 'LED Desk Lamp', 'Home', 4, 45.00, '2023-08-01', 1],
    [9, 'Retired Product', 'Kitchen', 1, 10.00, '2023-01-01', 0],
  ]
  const insP = db.prepare('INSERT INTO analytics.products VALUES (?, ?, ?, ?, ?, ?, ?)')
  for (const r of products) insP.run(...r)

  // ── Suppliers ──────────────────────────────────────────────────────────────
  // Some inactive (filtered out by cube WHERE)
  const suppliers = [
    [1, 'Organic Harvest Co',  'US', 'premium',   '2022-06-01', 1],
    [2, 'EcoGoods Inc',       'CN', 'standard',  '2022-08-15', 1],
    [3, 'WoolTraders Ltd',    'UK', 'premium',   '2023-01-10', 1],
    [4, 'HomeCraft Supplies', 'DE', 'standard',  '2023-03-20', 1],
    [5, 'TechFab Corp',       'US', 'basic',     '2023-06-01', 1],
    [6, 'Old Supplier Co',    'US', 'standard',  '2022-01-01', 0],
  ]
  const insS = db.prepare('INSERT INTO analytics.suppliers VALUES (?, ?, ?, ?, ?, ?)')
  for (const r of suppliers) insS.run(...r)

  // ── Shipments ──────────────────────────────────────────────────────────────
  // Various carriers, destinations, dates. Some undelivered (null delivered_at)
  const shipments = [
    [1,  1, 'FedEx',   'FX-001', '2023-06-17', '2023-06-22', 12.50, 'New York'],
    [2,  1, 'UPS',     'UP-002', '2023-06-17', '2023-06-23', 15.00, 'New York'],
    [3,  2, 'FedEx',   'FX-003', '2023-09-22', '2023-09-26', 8.75,  'New York'],
    [4,  3, 'USPS',    'US-004', '2024-01-12', '2024-01-18', 6.00,  'Chicago'],
    [5,  5, 'FedEx',   'FX-005', '2024-04-17', '2024-04-20', 14.50, 'Mexico City'],
    [6,  6, 'UPS',     'UP-006', '2024-06-03', '2024-06-10', 18.00, 'Mexico City'],
    [7,  7, 'DHL',     'DH-007', '2024-07-14', '2024-07-16', 22.00, 'Berlin'],
    [8,  8, 'FedEx',   'FX-008', '2024-09-03', '2024-09-09', 11.25, 'Berlin'],
    [9,  10, 'USPS',   'US-009', '2024-11-06', null,         5.50,  'New York'],
    [10, 11, 'DHL',    'DH-010', '2025-01-16', '2025-01-20', 20.00, 'Berlin'],
    [11, 12, 'UPS',    'UP-011', '2025-03-01', '2025-03-05', 16.50, 'Chicago'],
    [12, 9,  'FedEx',  'FX-012', '2024-10-22', '2024-10-25', 13.00, 'New York'],
  ]
  const insSh = db.prepare('INSERT INTO analytics.shipments VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  for (const r of shipments) insSh.run(...r)
}
