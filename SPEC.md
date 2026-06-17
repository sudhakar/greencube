# GreenCube Reports UI

Single-page React app for configurable grid-based reports on top of GreenCube. All state in localStorage. Monorepo with `server/` (existing API) and `web/` (UI to build) — each has own `package.json` to separate dependencies.

---

## 1. GreenCube REST API

```
GET  /cube/meta   -> discovery (cubes, fields, types, titles)
POST /cube/query  -> execute a Query -> { data: Record<string, unknown>[] }
POST /cube/explain-> compiled SQL
GET  /cube/try    -> HTML playground (ignore)
```

Server at `http://localhost:3003`.

### `GET /cube/meta`

```json
{
  "cubes": [{
    "name": "Orders",
    "measures": [
      { "name": "Orders.count", "title": "Orders", "type": "count" },
      { "name": "Orders.total", "title": "Revenue", "type": "sum" }
    ],
    "dimensions": [
      { "name": "Orders.id", "title": "ID", "type": "number" },
      { "name": "Orders.status", "title": "Status", "type": "string" }
    ],
    "timeDimensions": [
      { "name": "Orders.ordered_at", "title": "Order Date", "type": "time" }
    ]
  }],
  "samples": [{ "name": "Revenue by Status", "json": { "measures": ["Orders.total"], "dimensions": ["Orders.status"] } }],
  "routes": [
    { "method": "GET", "path": "/meta", "description": "..." },
    { "method": "POST", "path": "/query", "description": "..." },
    { "method": "POST", "path": "/explain", "description": "..." }
  ]
}
```

Field naming: `CubeName.fieldName`. To resolve a response column, split on first `.`, find matching entry in measures/dimensions/timeDimensions.

### `POST /cube/query`

Request:
```json
{
  "measures": ["Orders.total"],
  "dimensions": ["Orders.status"],
  "timeDimensions": [{ "dimension": "Orders.ordered_at", "granularity": "month" }],
  "filters": [{ "member": "Orders.status", "operator": "equals", "values": ["completed"] }],
  "order": { "Orders.total": "desc" },
  "limit": 10
}
```

`measures` only required field. Filter operators: `equals`, `notEquals`, `contains`, `notContains`, `startsWith`, `endsWith`, `gt`, `gte`, `lt`, `lte`, `inDateRange`, `notInDateRange`, `set`, `notSet`, `beforeDate`, `afterDate`. Multiple values in `equals` → `IN (...)`. `inDateRange` expects `[start, end]` as `YYYY-MM-DD`. Nested: `{ and: [...] }` / `{ or: [...] }`.

Success 200: `{ "data": [{ "Orders.total": 5000, "Orders.status": "completed" }] }`
Error 400: `{ "error": "..." }`

---

## 2. localStorage

Key: `greencube-reports`.

```typescript
type WidgetType = 'number' | 'gauge' | 'bar' | 'line' | 'area' | 'pie' | 'table' | 'metric'

interface Report {
  id: string        // nanoid
  title: string
  widgets: WidgetInstance[]
  layout: LayoutItem[]
  createdAt: number
  updatedAt: number
}

interface LayoutItem {
  i: string        // matches WidgetInstance.id
  x: number; y: number; w: number; h: number
  minW?: number; minH?: number
}

interface WidgetInstance {
  id: string
  type: WidgetType
  title: string
  query: object     // GreenCube Query
  config: object    // type-specific config below
}
```

---

## 3. Widget configs (stored in `WidgetInstance.config`)

Common per-column settings (keyed by response column name):
```
columns: Record<string, { label?, visible?, color?, precision?, prefix?, suffix?, formatter?: "number"|"percent"|"currency"|"compact"|"date"|"datetime" }>
```

**number:** `{ valueField, trendField?, trendLabel?, prefix?, suffix?, decimals?, color? }`

**gauge:** `{ valueField, min?, max?, thresholds?: { from, to, color }[], format? }`

**bar/line/area:** `{ xField, yFields: string[], stacked?, horizontal?, sortBy?, sortDirection?, limit?, showLegend?, showGrid?, showValues? }`

**pie:** `{ labelField, valueField, donut?, showPercent?, showLegend?, maxSlices? }`

**table:** `{ pageSize?, sortable?, searchable?, wrapLines? }`

**metric:** `{ fields: { label, valueField, prefix?, suffix?, color?, formatter? }[] }`

---

## 4. Technology (web/)

- React 19.2 + Vite + TypeScript
- shadcn/ui (Dialog, Button, Select, Textarea, Popover, Command, Skeleton, etc.)
- Recharts (charts)
- react-grid-layout (grid)
- Tailwind CSS v4 + lucide-react icons
- **@rjsf/core + @rjsf/validator-ajv8** for widget config forms (auto-generated from JSON Schema)
- no routing — single page, report state in React context
- Dependencies: `react`, `react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `lucide-react`, `recharts`, `react-grid-layout`, `nanoid`, `@rjsf/core`, `@rjsf/validator-ajv8`. Run `npx shadcn@latest init`.

---

## 5. Add Widget flow (multi-step shadcn Dialog)

1. **Pick type** — grid of clickable cards per `WidgetType`
2. **Query** — plain `<textarea>` pre-filled with `{ "measures": [], "dimensions": [], "timeDimensions": [] }`. Show `/cube/meta` fields as a read-only cheatsheet. "Preview" button calls `/cube/query`, shows result table inline.
3. **Config** — built and rendered via RJSF. The app generates a JSON Schema per widget type that includes: title, column settings (label, color, formatter, precision per column from the preview result), and widget-specific fields (xField dropdown, yFields multi-select, toggles). RJSF renders the form; user edits and saves.
4. **Layout** — `x`, `y`, `w`, `h` number inputs, defaults to next available grid position

---

## 6. Rendering

On report load: read from localStorage → for each widget, call `/cube/query` → apply column formatting → render via widget component in `react-grid-layout`. Each widget wrapped in shared chrome: title + dropdown (Edit/Clone/Delete), loading skeleton, error with retry, "No data" placeholder.

---

## 7. Edge cases

- Multi-cube queries: `measures`/`dimensions` can reference any cube; server resolves joins
- No separate edit/view mode — grid always draggable, edit via dropdown
- `onLayoutChange` saves immediately
- Listen `window "storage"` event for cross-tab sync

---

## 8. Implementation order

1. Scaffold `web/` — Vite + React + TS + Tailwind + shadcn init
2. `lib/api.ts` — `fetchMeta()`, `executeQuery(query)` against `http://localhost:3003/cube/...`
3. `lib/storage.ts` — get/save reports, CRUD widgets+layouts
4. `lib/meta.ts` — resolve qualified column name to `{ title, type }` from meta
5. `report-list.tsx` — sidebar with report titles, new/rename/delete
6. `report-grid.tsx` — react-grid-layout, saves on layout change
7. `widget-frame.tsx` — chrome: title, menu, loading/error/empty
8. `add-widget-dialog.tsx` — 4-step dialog (type → query → config via RJSF → layout)
9. JSON schemas for each widget type — programmatically built, augmented with columns from preview results
10. Widget renderers: `number-widget.tsx` ... `table-widget.tsx`
11. `App.tsx` — fetch meta on mount, load reports, select active, render grid
